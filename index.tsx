import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('--- INDEX.TSX STARTING ---');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("FATAL: Could not find root element");
  throw new Error("Could not find root element to mount to");
}

rootElement.innerHTML = '<div style="padding: 20px; font-family: sans-serif;">Iniciando sistema...</div>';

try {
  console.log('Creating React Root...');
  const root = ReactDOM.createRoot(rootElement);
  console.log('Rendering App...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('Render Called Successfully');
} catch (err) {
  console.error('REACT MOUNT ERROR:', err);
  rootElement.innerHTML = `<div style="color:red; padding: 20px;">Error crítico al iniciar: ${err}</div>`;
}