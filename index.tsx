import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './queryClient';

import ErrorBoundary from './components/Common/ErrorBoundary';

// 배포 후 청크 해시 변경으로 인한 로딩 실패 시:
// 자동 reload 대신 토스트(VersionUpdateToast)에 시그널만 전달.
// 사용자가 작업 중인 폼 데이터를 잃지 않도록 명시적 새로고침을 요구함.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault?.(); // 기본 동작(콘솔 에러) 억제
  window.dispatchEvent(new CustomEvent('app:preload-error'));
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
