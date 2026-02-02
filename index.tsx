import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 배포 버전 확인용 로그
console.log('%c A-ONE Fire System v3.5 Loaded ', 'background: #222; color: #bada55; font-size: 20px;');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);