import { splitVendorChunkPlugin, UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import path from 'path';
import { createHtmlPlugin } from 'vite-plugin-html';
import react from '@vitejs/plugin-react';
import strip from '@rollup/plugin-strip';
import analyze from 'rollup-plugin-analyzer';
import removeHTMLAttributes from 'vite-plugin-react-remove-attributes';

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

const CSP = buildCSP({
  'default-src': [
    '\'self\''
  ],
  'connect-src': [
    '\'self\'',
    '*.alchemyapi.io', // Alchemy RPC
    'https://cloudflare-eth.com', // Cloudflare RPC
    '*.infura.io', // Infura RPC
    '*.bean.money', // Beanstalk APIs
    '*.snapshot.org', // Snapshot GraphQL API
    'wss://*.walletconnect.org',
    'wss://*.bridge.walletconnect.org',
    'registry.walletconnect.com',
    'wss://*.walletlink.org',
    '*.coinbase.com', // Wallet: Coinbase
    '*.google-analytics.com',
    '*.doubleclick.net'
  ],
  'style-src': [
    '\'self\'',
    '\'unsafe-inline\'' // Required for Emotion
  ],
  'script-src': [
    '\'self\'',
    '*.google-analytics.com',
    '*.googletagmanager.com',
    '\'sha256-D0XQFeW9gcWWp4NGlqN0xpmiObsjqCewnVFeAsys7qM=\'' // GA inline script
  ],
  'img-src': [
    '\'self\'',
    '*.githubusercontent.com', // Github imgaes included in gov proposals
    'https://*.arweave.net', // Arweave images included in gov proposals
    'https://arweave.net', // Arweave images included in gov proposals
    '*.walletconnect.com', // WalletConnect wallet viewer
    'data:', // Wallet connectors use data-uri QR codes
  ],
});

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
          csp: (process.env.NODE_ENV === 'production')
            ? `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`
            : ''
        }
      }
    }),
    splitVendorChunkPlugin(),
    analyze({ limit: 10 }),
    (process.env.NODE_ENV === 'production') && 
      removeHTMLAttributes({
        include: ['**/*.tsx', '**/*.jsx'],
        attributes: ['data-cy'],
        exclude: 'node_modules'
      })
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
} as UserConfig));
