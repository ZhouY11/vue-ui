import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageJson {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  buildOptions?: {
    vue?: boolean;
  };
}

export interface WorkspacePackage {
  name: string;
  shortName: string;
  dir: string;
  srcDir: string;
  entry: string;
  outDir: string;
  order: number;
  packageJson: PackageJson;
  hasVueSfc: boolean;
}

const currentDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(currentDir, '..');
export const packagesRoot = join(repoRoot, 'packages');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T;
}

function hasFileByExtension(dir: string, extension: string): boolean {
  if (!existsSync(dir)) return false;

  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (hasFileByExtension(fullPath, extension)) return true;
      continue;
    }

    if (fullPath.endsWith(extension)) {
      return true;
    }
  }

  return false;
}

function scanWorkspacePackages(): WorkspacePackage[] {
  if (!existsSync(packagesRoot)) return [];

  return readdirSync(packagesRoot)
    .map((name) => join(packagesRoot, name))
    .filter((dir) => statSync(dir).isDirectory())
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir, order) => {
      const packageJson = readJson<PackageJson>(join(dir, 'package.json'));

      if (!packageJson.name) {
        throw new Error(`[build] Missing package name: ${dir}`);
      }

      const srcDir = join(dir, 'src');
      const entry = join(srcDir, 'index.ts');

      if (!existsSync(entry)) {
        throw new Error(`[build] Missing entry: ${entry}`);
      }

      return {
        name: packageJson.name,
        shortName: packageJson.name.split('/').at(-1)!,
        dir,
        srcDir,
        entry,
        outDir: join(dir, 'dist'),
        order,
        packageJson,
        hasVueSfc: !!packageJson.buildOptions?.vue
      };
    });
}

function getDeclaredDependencyNames(pkg: WorkspacePackage): string[] {
  const {
    dependencies = {},
    peerDependencies = {},
    optionalDependencies = {}
  } = pkg.packageJson;

  return [
    ...Object.keys(dependencies),
    ...Object.keys(peerDependencies),
    ...Object.keys(optionalDependencies)
  ];
}

export class WorkspaceGraph {
  readonly packages: WorkspacePackage[];
  readonly packageMap: Map<string, WorkspacePackage>;
  readonly aliasMap: Map<string, WorkspacePackage>;
  readonly dependencyMap: Map<string, string[]>;

  constructor(packages: WorkspacePackage[]) {
    this.packages = packages;
    this.packageMap = new Map();
    this.aliasMap = new Map();
    this.dependencyMap = new Map();

    for (const pkg of packages) {
      if (this.packageMap.has(pkg.name)) {
        throw new Error(`[build] Duplicate package name: ${pkg.name}`);
      }

      this.packageMap.set(pkg.name, pkg);
      this.addAlias(pkg.name, pkg);
      this.addAlias(pkg.shortName, pkg);
    }

    const internalNames = new Set(this.packageMap.keys());

    for (const pkg of packages) {
      const internalDependencies = getDeclaredDependencyNames(pkg).filter(
        (name) => internalNames.has(name)
      );

      this.dependencyMap.set(pkg.name, internalDependencies);
    }
  }

  private addAlias(alias: string, pkg: WorkspacePackage): void {
    const existing = this.aliasMap.get(alias);

    if (existing && existing.name !== pkg.name) {
      throw new Error(
        `[build] Ambiguous package alias "${alias}": ` +
          `${existing.name}, ${pkg.name}`
      );
    }

    this.aliasMap.set(alias, pkg);
  }

  resolveTargets(targetNames: string[]): WorkspacePackage[] {
    if (targetNames.length === 0) {
      return this.packages;
    }

    const result = new Map<string, WorkspacePackage>();
    const missing: string[] = [];

    for (const targetName of targetNames) {
      const pkg = this.aliasMap.get(targetName);

      if (!pkg) {
        missing.push(targetName);
        continue;
      }

      result.set(pkg.name, pkg);
    }

    if (missing.length > 0) {
      const available = this.packages
        .map((pkg) => `${pkg.shortName}(${pkg.name})`)
        .join(', ');

      throw new Error(
        `[build] Unknown package: ${missing.join(', ')}\n` +
          `[build] Available packages: ${available}`
      );
    }

    return [...result.values()];
  }

  collectWithDependencies(targets: WorkspacePackage[]): WorkspacePackage[] {
    const result = new Map<string, WorkspacePackage>();

    const collect = (pkg: WorkspacePackage) => {
      if (result.has(pkg.name)) return;

      result.set(pkg.name, pkg);

      const dependencyNames = this.dependencyMap.get(pkg.name) ?? [];

      for (const dependencyName of dependencyNames) {
        const dependency = this.packageMap.get(dependencyName);

        if (!dependency) {
          throw new Error(
            `[build] Internal dependency not found: ${dependencyName}`
          );
        }

        collect(dependency);
      }
    };

    for (const target of targets) {
      collect(target);
    }

    return [...result.values()];
  }

  sortByDependencies(packages: WorkspacePackage[]): WorkspacePackage[] {
    const packageNameSet = new Set(packages.map((pkg) => pkg.name));
    const sortedInput = [...packages].sort((a, b) => a.order - b.order);

    const result: WorkspacePackage[] = [];
    const state = new Map<string, 'visiting' | 'visited'>();
    const stack: string[] = [];

    const visit = (pkg: WorkspacePackage) => {
      const currentState = state.get(pkg.name);

      if (currentState === 'visited') return;

      if (currentState === 'visiting') {
        const cycleStart = stack.indexOf(pkg.name);
        const cyclePath = [...stack.slice(cycleStart), pkg.name].join(' -> ');

        throw new Error(`[build] Circular dependency detected: ${cyclePath}`);
      }

      state.set(pkg.name, 'visiting');
      stack.push(pkg.name);

      const dependencyNames = this.dependencyMap.get(pkg.name) ?? [];

      for (const dependencyName of dependencyNames) {
        if (!packageNameSet.has(dependencyName)) continue;

        const dependency = this.packageMap.get(dependencyName);

        if (!dependency) {
          throw new Error(
            `[build] Internal dependency not found: ${dependencyName}`
          );
        }

        visit(dependency);
      }

      stack.pop();
      state.set(pkg.name, 'visited');
      result.push(pkg);
    };

    for (const pkg of sortedInput) {
      visit(pkg);
    }

    return result;
  }

  getExternalDependencies(pkg: WorkspacePackage): string[] {
    return getDeclaredDependencyNames(pkg);
  }
}

export function createWorkspaceGraph(): WorkspaceGraph {
  return new WorkspaceGraph(scanWorkspacePackages());
}