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
      // 번들 최적화: 코드 스플리팅 - Addresses Issue #16
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              // Firebase - 가장 큰 의존성
              if (id.includes('firebase')) {
                return 'firebase';
              }
              
              // React core
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              
              // React Query
              if (id.includes('@tanstack/react-query')) {
                return 'react-query';
              }
              
              // Charts - 큰 라이브러리
              if (id.includes('recharts')) {
                return 'charts';
              }
              
              // Date utilities
              if (id.includes('date-fns')) {
                return 'date-fns';
              }
              
              // Icons - Lucide
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              
              // DnD Kit
              if (id.includes('@dnd-kit')) {
                return 'dnd-kit';
              }
              
              // PDF generation - lazy load
              if (id.includes('html2canvas') || id.includes('jspdf')) {
                return 'pdf-generation';
              }
              
              // OCR - lazy load
              if (id.includes('tesseract')) {
                return 'ocr';
              }
              
              // Markdown
              if (id.includes('react-markdown')) {
                return 'markdown';
              }
              
              // Common components - separate chunk
              if (id.includes('/components/Common/')) {
                return 'common-components';
              }
              
              // Node modules that are not separated above
              if (id.includes('node_modules')) {
                return 'vendor';
              }
            },
          },
        },
        // 청크 크기 경고 임계값 줄임
        chunkSizeWarningLimit: 500,
        // 소스맵 비활성화 for production
        sourcemap: false,
      },
    };
});
