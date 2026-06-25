import { join } from 'node:path';
import type { InputOptions, OutputOptions, Plugin } from 'rollup';
import Vue from 'unplugin-vue/rollup';
import esbuild from 'rollup-plugin-esbuild';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import type { WorkspaceGraph, WorkspacePackage } from './workspace';

export interface RollupPackageConfig {
  input: InputOptions;
  outputs: OutputOptions[];
}

export function createPackageConfig(
  graph: WorkspaceGraph,
  pkg: WorkspacePackage
): RollupPackageConfig {
  const isVuePackage = pkg.hasVueSfc

  const plugins: Plugin[] = [
    isVuePackage &&
      Vue({
        isProduction: true
      }),

    nodeResolve({
      extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.vue'],
      browser: true
    }),

    commonjs(),

    esbuild({
      tsconfig: join(pkg.dir, 'tsconfig.json'),
      target: 'es2022',
      sourceMap: true,
      loaders: {
        '.vue': 'ts'
      }
    })
  ].filter(Boolean) as Plugin[];

  return {
    input: {
      input: join(pkg.dir, 'src/index.ts'),
      plugins,
      external: createExternalPredicate(graph.getExternalDependencies(pkg)),
      treeshake: {
        moduleSideEffects: 'no-external'
      }
    },

    outputs: [
      {
        file: join(pkg.dir, 'dist/index.js'),
        format: 'esm',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: join(pkg.dir, 'dist/index.cjs'),
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      }
    ]
  };
}

function createExternalPredicate(dependencies: string[]) {
  return (id: string): boolean => {
    return dependencies.some((dep) => {
      return id === dep || id.startsWith(`${dep}/`);
    });
  };
}