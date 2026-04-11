import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error listener to catch initialization crashes
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global Error Caught:", { message, source, lineno, colno, error });
  
  // If the app hasn't rendered yet or crashed immediately, show a fallback
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `
      <div style="height: 100vh; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">Application Error</h1>
        <p style="color: #94a3b8; max-width: 400px; margin-bottom: 2rem;">
          The application failed to start. This is usually due to missing or invalid API keys in your environment variables.
        </p>
        <div style="background: #1e293b; padding: 15px; border-radius: 10px; margin-bottom: 2rem; font-family: monospace; font-size: 0.8rem; color: #f87171; text-align: left; max-width: 500px; overflow: auto;">
          ${message}
        </div>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #2563eb; border: none; border-radius: 50px; color: white; font-weight: bold; cursor: pointer;">
          Try Again
        </button>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
