import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Build hash generated once per build, shared between define and writeBundle
const BUILD_HASH = crypto.randomBytes(8).toString('hex');

// Plugin to generate version.json with build hash for cache-busting
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    transformIndexHtml(html) {
      // index.html 인라인 스크립트의 %%BUILD_HASH%%를 실제 해시로 치환
      return html.replace(/%%BUILD_HASH%%/g, BUILD_HASH);
    },
    writeBundle(options) {
      const versionData = {
        version: BUILD_HASH,
        buildTime: new Date().toISOString(),
      };
      const outDir = options.dir || 'dist';
      fs.writeFileSync(
        path.resolve(outDir, 'version.json'),
        JSON.stringify(versionData)
      );
    },
  };
}

// Plugin to ensure correct chunk loading order in HTML
function chunkOrderPlugin(): Plugin {
  return {
    name: 'chunk-order-plugin',
    enforce: 'post',
    transformIndexHtml(html) {
      // Replace modulepreload links with script tags in correct order
      return html.replace(
        /(<script type="module"[^>]*src="\/assets\/index-[^"]+\.js"><\/script>)/,
        (match) => {
          // Extract chunk file names from modulepreload links
          const vendorMatch = html.match(/href="(\/assets\/vendor-[^"]+\.js)"/);
          const lucideMatch = html.match(/href="(\/assets\/lucide-[^"]+\.js)"/);

          if (vendorMatch && lucideMatch) {
            return `  <script type="module" crossorigin src="${vendorMatch[1]}"></script>
  <script type="module" crossorigin src="${lucideMatch[1]}"></script>
${match}`;
          }
          return match;
        }
      );
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), chunkOrderPlugin(), versionPlugin()],
    optimizeDeps: {
      include: ['lucide-react'],
      exclude: []
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(isProduction ? BUILD_HASH : 'dev'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // 프로덕션 빌드 시 console.log/debug/info 제거 (console.error, console.warn 유지)
    esbuild: {
      drop: isProduction ? ['debugger'] : [],
      pure: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
    },
    // 번들 최적화: 코드 스플리팅 - Addresses Issue #16
    build: {
      rollupOptions: {
        output: {
          // Ensure proper chunk loading order
          inlineDynamicImports: false,
          manualChunks: (id) => {
            // React 코어 - 별도 청크로 분리 (캐싱 효율화)
            if (id.includes('node_modules/react-dom')) {
              return 'react-dom';
            }
            if (id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
              return 'react';
            }

            // Firebase - 하나의 청크로 통합 (순환 참조 방지)
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'firebase';
            }

            // Lucide-react in separate chunk
            if (id.includes('lucide-react')) {
              return 'lucide';
            }

            // Charts - 큰 라이브러리
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts';
            }

            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-fns';
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
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified')) {
              return 'markdown';
            }

            // Excel processing
            if (id.includes('xlsx')) {
              return 'xlsx';
            }

            // Google AI
            if (id.includes('@google/genai') || id.includes('@google/generative-ai')) {
              return 'google-ai';
            }

            // Tanstack React Query
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }

            // Common components - separate chunk
            if (id.includes('/components/Common/')) {
              return 'common-components';
            }

            // 나머지 node_modules
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
