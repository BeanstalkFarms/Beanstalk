import { splitVendorChunkPlugin } from 'vite';
import { defineConfig } from 'vitest/config';
import path from 'path';
import { createHtmlPlugin } from 'vite-plugin-html';
import react from '@vitejs/plugin-react';
import strip from '@rollup/plugin-strip';
import analyze from 'rollup-plugin-analyzer';

type CSPData = {
  'default-src': string[];
  'connect-src': string[];
  'style-src': string[];
  'script-src': string[];
  'img-src': string[];
}

function buildCSP(data: CSPData) {
  return Object.keys(data).map(
    (key) => `${key} ${data[key].join(' ')}`
  ).join(';');
}

// default-src 'self'; connect-src 'self' *.alchemyapi.io *.bean.money *.snapshot.org wss://*.walletconnect.org wss://*.bridge.walletconnect.org registry.walletconnect.com wss://*.walletlink.org *.google-analytics.com *.doubleclick.net; style-src 'self' 'unsafe-inline'; script-src 'self' *.google-analytics.com *.googletagmanager.com 'sha256-D0XQFeW9gcWWp4NGlqN0xpmiObsjqCewnVFeAsys7qM=';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  test: {
    globals: true,
  },
  server: {
    hmr: {
      overlay: true
    }
  },
  plugins: [
    react({
      // This definition ensures that the `css` prop from Emotion 
      // works at build time. The one in tsconfig.json ensures that
      // the IDE doesn't throw errors when using the prop.
      jsxImportSource: '@emotion/react',
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          csp: buildCSP({
            'default-src': [
              '\'self\''
            ],
            'connect-src': [
              '\'self\'',
              '*.alchemyapi.io',
              '*.bean.money',
              '*.snapshot.org',
              'wss://*.walletconnect.org',
              'wss://*.bridge.walletconnect.org',
              'registry.walletconnect.com',
              'wss://*.walletlink.org',
              '*.coinbase.com',
              '*.google-analytics.com',
              '*.doubleclick.net'
            ],
            'style-src': [
              '\'self\'',
              '\'unsafe-inline\''
            ],
            'script-src': [
              '\'self\'',
              '*.google-analytics.com',
              '*.googletagmanager.com',
              '\'sha256-D0XQFeW9gcWWp4NGlqN0xpmiObsjqCewnVFeAsys7qM=\'' // GA inline script
            ],
            'img-src': [
              '\'self\'',
              '*.githubusercontent.com',
              'https://*.arweave.net',
              'https://arweave.net',
              'data:',
            ],
          })
        }
      }
    }),
    splitVendorChunkPlugin(),
    analyze({ limit: 10 }),
  ],
  resolve: {
    alias: [
      {
        find: '~',
        replacement: path.resolve(__dirname, 'src')
      },
    ],
  },
  build: {
    sourcemap: command === 'serve',
    reportCompressedSize: true,
    rollupOptions: {
      plugins: [
        strip({
          functions: ['console.debug'],
          include: '**/*.(ts|tsx)',
        }),
      ]
    }
  }
}));
