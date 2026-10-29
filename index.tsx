import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err) {
  console.error("Critical app startup error:", err);
  rootElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #F8FAFC; padding: 20px; font-family: sans-serif;">
      <div style="background: white; border: 1px solid #E2E8F0; padding: 24px; border-radius: 12px; max-width: 480px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h3 style="color: #E11D48; margin-top: 0;">GlobalCodeTrans 工作台初始化提示</h3>
        <p style="font-size: 13px; color: #475569; line-height: 1.6;">系统加载遇到了初始化异常。这通常是由于浏览器缓存或内存受限导致。</p>
        <button onclick="window.location.reload()" style="background: #0D9488; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 12px;">刷新重新加载</button>
      </div>
    </div>
  `;
}
