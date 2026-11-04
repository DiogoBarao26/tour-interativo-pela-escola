import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function spaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    closeBundle() {
      const base = process.env.VITE_BASE_PATH || '/';
      const segments = base.split('/').filter(Boolean).length;
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Tour Interativo pela Escola</title>
    <script>
      // SPA fallback for GitHub Pages (MIT) https://github.com/rafgraph/spa-github-pages
      var pathSegmentsToKeep = ${segments};
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body></body>
</html>
`;
      writeFileSync(resolve(process.cwd(), 'dist', '404.html'), html);
    },
  };
}

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), spaFallback()],
  resolve: {
    alias: {
      '@devonly/backend': resolve(
        process.cwd(),
        command === 'serve' ? 'src/dev/devBackend.ts' : 'src/dev/devBackend.stub.ts',
      ),
    },
  },
}));
