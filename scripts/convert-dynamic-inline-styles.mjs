#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 동적 인라인 스타일 변환
const DYNAMIC_CONVERSIONS = [
  // 조건부 backgroundColor (accent)
  {
    pattern: /backgroundColor:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\?\s*['"`]#fdb813['"`]\s*:\s*['"`]transparent['"`]/g,
    replacement: "backgroundColor: $1 ? 'rgb(253, 184, 19)' /* accent */ : 'transparent'",
    description: 'Dynamic backgroundColor: #fdb813'
  },
  {
    pattern: /backgroundColor:\s*['"`]#fdb813['"`]\s*:\s*['"`]transparent['"`]/g,
    replacement: "backgroundColor: 'rgb(253, 184, 19)' /* accent */ : 'transparent'",
    description: 'Static backgroundColor: #fdb813'
  },

  // 투명도가 적용된 borderColor
  {
    pattern: /borderBottomColor:\s*['"`]#08142910['"`]/g,
    replacement: "borderBottomColor: 'rgba(8, 20, 41, 0.063)' /* primary with opacity */",
    description: 'borderBottomColor: #08142910'
  },
  {
    pattern: /borderTop:\s*['"`]1px solid #08142915['"`]/g,
    replacement: "borderTop: '1px solid rgba(8, 20, 41, 0.08)' /* primary with opacity */",
    description: 'borderTop with primary opacity'
  },

  // textShadow
  {
    pattern: /textShadow:\s*"1px 1px 0px #081429"/g,
    replacement: 'textShadow: "1px 1px 0px rgb(8, 20, 41)" /* primary */',
    description: 'textShadow: #081429'
  },
];

async function convertDynamicStyles(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let changeCount = 0;
  const changes = [];

  for (const { pattern, replacement, description } of DYNAMIC_CONVERSIONS) {
    const matches = content.match(pattern);
    if (matches) {
      changeCount += matches.length;
      changes.push({
        description,
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
  console.log('🎨 동적 인라인 스타일 색상 변환 중...\n');

  const files = await glob('components/**/*.{tsx,ts}', {
    cwd: rootDir,
    absolute: true
  });

  let totalChanges = 0;
  let modifiedFiles = 0;
  const fileResults = [];

  for (const file of files) {
    const result = await convertDynamicStyles(file);
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
  console.log(`- 수정된 파일: ${modifiedFiles}개`);
  console.log(`- 총 변경 횟수: ${totalChanges}회\n`);

  if (modifiedFiles > 0) {
    console.log('📝 수정된 파일:\n');
    for (const result of fileResults) {
      console.log(`  ${result.path} (${result.changes}회)`);
      result.details.forEach(detail => {
        console.log(`    - ${detail.description} (${detail.count}회)`);
      });
    }
  }
}

main().catch(console.error);
