#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 색상 변환 매핑
const COLOR_MAPPINGS = [
  // Primary color (#081429)
  { pattern: /bg-\[#081429\]/g, replacement: 'bg-primary' },
  { pattern: /text-\[#081429\]/g, replacement: 'text-primary' },
  { pattern: /border-\[#081429\]/g, replacement: 'border-primary' },
  { pattern: /hover:bg-\[#081429\]/g, replacement: 'hover:bg-primary' },
  { pattern: /hover:text-\[#081429\]/g, replacement: 'hover:text-primary' },
  { pattern: /hover:border-\[#081429\]/g, replacement: 'hover:border-primary' },
  { pattern: /focus:ring-\[#081429\]/g, replacement: 'focus:ring-primary' },
  { pattern: /focus:border-\[#081429\]/g, replacement: 'focus:border-primary' },

  // Accent color (#fdb813)
  { pattern: /bg-\[#fdb813\]/g, replacement: 'bg-accent' },
  { pattern: /text-\[#fdb813\]/g, replacement: 'text-accent' },
  { pattern: /border-\[#fdb813\]/g, replacement: 'border-accent' },
  { pattern: /hover:bg-\[#fdb813\]/g, replacement: 'hover:bg-accent' },
  { pattern: /hover:text-\[#fdb813\]/g, replacement: 'hover:text-accent' },
  { pattern: /hover:border-\[#fdb813\]/g, replacement: 'hover:border-accent' },
  { pattern: /focus:ring-\[#fdb813\]/g, replacement: 'focus:ring-accent' },
  { pattern: /focus:border-\[#fdb813\]/g, replacement: 'focus:border-accent' },

  // Dark gray (#373d41) - map to primary-700
  { pattern: /bg-\[#373d41\]/g, replacement: 'bg-primary-700' },
  { pattern: /text-\[#373d41\]/g, replacement: 'text-primary-700' },
  { pattern: /border-\[#373d41\]/g, replacement: 'border-primary-700' },

  // Success color (#10b981)
  { pattern: /bg-\[#10b981\]/g, replacement: 'bg-success' },
  { pattern: /text-\[#10b981\]/g, replacement: 'text-success' },
  { pattern: /border-\[#10b981\]/g, replacement: 'border-success' },
  { pattern: /hover:bg-\[#10b981\]/g, replacement: 'hover:bg-success' },

  // Error color (#ef4444)
  { pattern: /bg-\[#ef4444\]/g, replacement: 'bg-error' },
  { pattern: /text-\[#ef4444\]/g, replacement: 'text-error' },
  { pattern: /border-\[#ef4444\]/g, replacement: 'border-error' },
  { pattern: /hover:bg-\[#ef4444\]/g, replacement: 'hover:bg-error' },

  // Warning color (#f59e0b)
  { pattern: /bg-\[#f59e0b\]/g, replacement: 'bg-warning' },
  { pattern: /text-\[#f59e0b\]/g, replacement: 'text-warning' },
  { pattern: /border-\[#f59e0b\]/g, replacement: 'border-warning' },
  { pattern: /hover:bg-\[#f59e0b\]/g, replacement: 'hover:bg-warning' },

  // Info color (#3b82f6)
  { pattern: /bg-\[#3b82f6\]/g, replacement: 'bg-info' },
  { pattern: /text-\[#3b82f6\]/g, replacement: 'text-info' },
  { pattern: /border-\[#3b82f6\]/g, replacement: 'border-info' },
  { pattern: /hover:bg-\[#3b82f6\]/g, replacement: 'hover:bg-info' },

  // Hover variants for primary darker shades
  { pattern: /hover:bg-\[#0a1a35\]/g, replacement: 'hover:bg-primary-800' },
  { pattern: /hover:bg-\[#102a43\]/g, replacement: 'hover:bg-primary-900' },
];

async function convertFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let changeCount = 0;
  const changes = [];

  for (const { pattern, replacement } of COLOR_MAPPINGS) {
    const matches = content.match(pattern);
    if (matches) {
      changeCount += matches.length;
      changes.push({
        pattern: pattern.source,
        replacement,
        count: matches.length
      });
      content = content.replace(pattern, replacement);
    }
  }

  if (changeCount > 0) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { changeCount, changes };
}

async function main() {
  console.log('🎨 하드코딩 색상을 Tailwind 클래스로 변환 중...\n');

  const files = await glob('components/**/*.tsx', {
    cwd: rootDir,
    absolute: true
  });

  let totalChanges = 0;
  let modifiedFiles = 0;
  const fileResults = [];

  for (const file of files) {
    const result = await convertFile(file);
    if (result.changeCount > 0) {
      totalChanges += result.changeCount;
      modifiedFiles++;
      const relativePath = file.replace(rootDir + '\\', '').replace(/\\/g, '/');
      fileResults.push({
        path: relativePath,
        changes: result.changeCount,
        details: result.changes
      });
    }
  }

  console.log('✅ 변환 완료!\n');
  console.log(`📊 요약:`);
  console.log(`- 총 파일 수: ${files.length}개`);
  console.log(`- 수정된 파일: ${modifiedFiles}개`);
  console.log(`- 총 변경 횟수: ${totalChanges}회\n`);

  if (modifiedFiles > 0) {
    console.log('📝 수정된 파일 목록:\n');

    // 변경 횟수로 정렬
    fileResults.sort((a, b) => b.changes - a.changes);

    for (const result of fileResults.slice(0, 20)) {
      console.log(`  ${result.path} (${result.changes}회 변경)`);
    }

    if (fileResults.length > 20) {
      console.log(`  ... 외 ${fileResults.length - 20}개 파일`);
    }
  }

  // 상세 보고서 저장
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    modifiedFiles,
    totalChanges,
    files: fileResults
  };

  writeFileSync(
    join(rootDir, 'color-conversion-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  console.log('\n📄 상세 보고서: color-conversion-report.json');
}

main().catch(console.error);
