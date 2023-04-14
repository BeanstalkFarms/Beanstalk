import React from 'react';
import { createRoot } from 'react-dom/client';

import App from '~/components/App';
import Wrapper from '~/components/App/Wrapper';

import './index.css';
import reportWebVitals from './reportWebVitals';

if (import.meta.env.DEV) {
  const showErrorOverlay = (err: any) => {
    // must be within function call because that's when the element is defined for sure.
    const ErrorOverlay = customElements.get('vite-error-overlay');
    // don't open outside vite environment
    if (!ErrorOverlay) { return; }
    console.log(err);
    const overlay = new ErrorOverlay(err);
    document.body.appendChild(overlay);
  };
  window.addEventListener('error', ({ error }) => showErrorOverlay(error));
  window.addEventListener('unhandledrejection', ({ reason }) => showErrorOverlay(reason));
}

const container = document.getElementById('app');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <Wrapper>
      <App />
    </Wrapper>
  </React.StrictMode>
);

reportWebVitals();
