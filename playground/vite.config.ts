import { join } from 'node:path';

import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: [
      {
        find: /@vue-ui\/(.+)$/,
        replacement: join(__dirname, '../packages', '$1', 'src')
      }
    ]
  },
});