import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // 프로덕션 빌드 시 console.log 제거 (console.error, console.warn 유지)
      esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
        pure: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
      },
      // 번들 최적화: 코드 스플리팅
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Firebase를 별도 청크로 분리 (가장 큰 의존성)
              'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              // React 관련 라이브러리
              'react-vendor': ['react', 'react-dom'],
              // 차트/시각화 라이브러리
              'charts': ['recharts'],
              // 유틸리티 라이브러리
              'utils': ['date-fns'],
            },
          },
        },
        // 청크 크기 경고 임계값 (KB)
        chunkSizeWarningLimit: 600,
      },
    };
});
