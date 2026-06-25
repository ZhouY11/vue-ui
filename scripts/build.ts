
import { rm } from 'node:fs/promises';

import { rollup } from 'rollup';
import { createPackageConfig } from './build-config';
import { createWorkspaceGraph } from './workspace';

interface BuildCliOptions {
  targets: string[];
  watch: boolean;
  only: boolean;
}

function parseArgs(args: string[]): BuildCliOptions {
  const targets: string[] = [];
  let watch = false;
  let only = false;

  for (const arg of args) {
    if (arg === '--watch' || arg === '-w') {
      watch = true;
      continue;
    }

    if (arg === '--only') {
      only = true;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`[build] Unknown option: ${arg}`);
    }

    targets.push(arg);
  }

  return {
    targets,
    watch,
    only
  };
}

async function buildPackage(
  graph: ReturnType<typeof createWorkspaceGraph>,
  pkg: ReturnType<typeof createWorkspaceGraph>['packages'][number]
) {
  console.log(`\n[rollup] ${pkg.name}`);

  await rm(pkg.outDir, {
    recursive: true,
    force: true
  });

  const config = createPackageConfig(graph, pkg);

  const bundle = await rollup(config.input);

  try {
    for (const output of config.outputs) {
      await bundle.write(output);
    }
  } finally {
    await bundle.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const graph = createWorkspaceGraph();

  const rawTargets = graph.resolveTargets(options.targets);

  const buildTargets = options.only
    ? rawTargets
    : graph.collectWithDependencies(rawTargets);

  const sortedTargets = graph.sortByDependencies(buildTargets);

  console.log(
    `[build] Building packages:\n${sortedTargets
      .map((pkg) => `  - ${pkg.name}`)
      .join('\n')}`
  );

  for (const pkg of sortedTargets) {
    await buildPackage(graph, pkg)
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});