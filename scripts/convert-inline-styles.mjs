#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 인라인 스타일에서 변환할 색상만 (primary, accent, primary-700)
const INLINE_STYLE_CONVERSIONS = [
  // Primary (#081429)
  {
    pattern: /color:\s*['"`]?#081429['"`]?/g,
    replacement: "color: 'rgb(8, 20, 41)' /* primary */",
    description: 'color: #081429 → primary'
  },
  {
    pattern: /backgroundColor:\s*['"`]?#081429['"`]?/g,
    replacement: "backgroundColor: 'rgb(8, 20, 41)' /* primary */",
    description: 'backgroundColor: #081429 → primary'
  },
  {
    pattern: /borderColor:\s*['"`]?#081429['"`]?/g,
    replacement: "borderColor: 'rgb(8, 20, 41)' /* primary */",
    description: 'borderColor: #081429 → primary'
  },

  // Accent (#fdb813)
  {
    pattern: /color:\s*['"`]?#fdb813['"`]?/g,
    replacement: "color: 'rgb(253, 184, 19)' /* accent */",
    description: 'color: #fdb813 → accent'
  },
  {
    pattern: /backgroundColor:\s*['"`]?#fdb813['"`]?/g,
    replacement: "backgroundColor: 'rgb(253, 184, 19)' /* accent */",
    description: 'backgroundColor: #fdb813 → accent'
  },
  {
    pattern: /borderColor:\s*['"`]?#fdb813['"`]?/g,
    replacement: "borderColor: 'rgb(253, 184, 19)' /* accent */",
    description: 'borderColor: #fdb813 → accent'
  },

  // Primary-700 (#373d41 -> primary-700: #334e68)
  {
    pattern: /color:\s*['"`]?#373d41['"`]?/g,
    replacement: "color: 'rgb(51, 78, 104)' /* primary-700 */",
    description: 'color: #373d41 → primary-700'
  },
  {
    pattern: /backgroundColor:\s*['"`]?#373d41['"`]?/g,
    replacement: "backgroundColor: 'rgb(51, 78, 104)' /* primary-700 */",
    description: 'backgroundColor: #373d41 → primary-700'
  },
  {
    pattern: /borderColor:\s*['"`]?#373d41['"`]?/g,
    replacement: "borderColor: 'rgb(51, 78, 104)' /* primary-700 */",
    description: 'borderColor: #373d41 → primary-700'
  },

  // 투명도 적용된 primary
  {
    pattern: /borderColor:\s*['"`]?#08142915['"`]?/g,
    replacement: "borderColor: 'rgba(8, 20, 41, 0.08)' /* primary with opacity */",
    description: 'borderColor: #08142915 → primary + opacity'
  },
  {
    pattern: /borderColor:\s*['"`]?#08142920['"`]?/g,
    replacement: "borderColor: 'rgba(8, 20, 41, 0.125)' /* primary with opacity */",
    description: 'borderColor: #08142920 → primary + opacity'
  },
  {
    pattern: /backgroundColor:\s*['"`]?#08142915['"`]?/g,
    replacement: "backgroundColor: 'rgba(8, 20, 41, 0.08)' /* primary with opacity */",
    description: 'backgroundColor: #08142915 → primary + opacity'
  },
];

async function convertInlineStyles(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let changeCount = 0;
  const changes = [];

  for (const { pattern, replacement, description } of INLINE_STYLE_CONVERSIONS) {
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
  console.log('🎨 인라인 스타일 색상 변환 중...\n');
  console.log('   변환 대상: primary (#081429), accent (#fdb813), primary-700 (#373d41)\n');

  const files = await glob('components/**/*.{tsx,ts}', {
    cwd: rootDir,
    absolute: true
  });

  let totalChanges = 0;
  let modifiedFiles = 0;
  const fileResults = [];

  for (const file of files) {
    const result = await convertInlineStyles(file);
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
    console.log('📝 수정된 파일:\n');

    fileResults.sort((a, b) => b.changes - a.changes);

    for (const result of fileResults) {
      console.log(`  ${result.path} (${result.changes}회)`);
      result.details.forEach(detail => {
        console.log(`    - ${detail.description} (${detail.count}회)`);
      });
    }
  }

  console.log('\n💡 참고:');
  console.log('   - RGB 값 사용으로 CSS 변수 적용 가능 (다크모드 지원)');
  console.log('   - 나머지 hex 색상은 동적 값이므로 유지');
}

main().catch(console.error);
