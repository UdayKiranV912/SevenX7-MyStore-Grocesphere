import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Comment: Access document through window as any to bypass potential environment type mismatch
const rootElement = (window as any).document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);