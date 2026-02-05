#!/usr/bin/env node

import { readFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function generateStats() {
  console.log('📊 최종 통계 생성 중...\n');

  const files = await glob('components/**/*.tsx', {
    cwd: rootDir,
    absolute: true
  });

  // 변환된 Tailwind 클래스 카운트
  const tailwindColorClasses = {
    'bg-primary': 0,
    'text-primary': 0,
    'border-primary': 0,
    'bg-accent': 0,
    'text-accent': 0,
    'border-accent': 0,
    'bg-primary-700': 0,
    'text-primary-700': 0,
    'bg-success': 0,
    'text-success': 0,
    'bg-error': 0,
    'text-error': 0,
    'bg-warning': 0,
    'text-warning': 0,
    'bg-info': 0,
    'text-info': 0,
    'hover:bg-primary': 0,
    'hover:bg-accent': 0,
    'hover:bg-accent-600': 0,
    'focus:ring-accent': 0,
  };

  const rgbUsage = {
    'rgb(8, 20, 41)': 0,  // primary
    'rgb(253, 184, 19)': 0,  // accent
    'rgb(51, 78, 104)': 0,  // primary-700
    'rgba(8, 20, 41': 0,  // primary with opacity
  };

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');

    // Tailwind 클래스 카운트
    for (const className of Object.keys(tailwindColorClasses)) {
      const regex = new RegExp(className, 'g');
      const matches = content.match(regex);
      if (matches) {
        tailwindColorClasses[className] += matches.length;
      }
    }

    // RGB 사용 카운트
    for (const rgb of Object.keys(rgbUsage)) {
      const matches = content.match(new RegExp(rgb.replace(/[()]/g, '\\$&'), 'g'));
      if (matches) {
        rgbUsage[rgb] += matches.length;
      }
    }
  }

  console.log('✅ Tailwind 색상 클래스 사용 현황:\n');

  const sortedClasses = Object.entries(tailwindColorClasses)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  sortedClasses.forEach(([className, count]) => {
    console.log(`   ${className.padEnd(25)} ${count.toString().padStart(4)}회`);
  });

  const totalTailwind = sortedClasses.reduce((sum, [_, count]) => sum + count, 0);
  console.log(`\n   ${'총 Tailwind 클래스'.padEnd(25)} ${totalTailwind.toString().padStart(4)}회\n`);

  console.log('✅ 인라인 스타일 RGB 사용 현황:\n');

  const sortedRgb = Object.entries(rgbUsage)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  sortedRgb.forEach(([rgb, count]) => {
    const label = rgb === 'rgb(8, 20, 41)' ? 'primary' :
                  rgb === 'rgb(253, 184, 19)' ? 'accent' :
                  rgb === 'rgb(51, 78, 104)' ? 'primary-700' :
                  'primary opacity';
    console.log(`   ${label.padEnd(20)} ${count.toString().padStart(4)}회`);
  });

  const totalRgb = sortedRgb.reduce((sum, [_, count]) => sum + count, 0);
  console.log(`\n   ${'총 인라인 RGB'.padEnd(20)} ${totalRgb.toString().padStart(4)}회\n`);

  console.log('📈 전체 요약:\n');
  console.log(`   총 파일 수:          ${files.length}개`);
  console.log(`   Tailwind 클래스:     ${totalTailwind}회`);
  console.log(`   인라인 RGB:          ${totalRgb}회`);
  console.log(`   총 변환 색상 사용:   ${totalTailwind + totalRgb}회\n`);

  console.log('✅ 통계 생성 완료!');
}

generateStats().catch(console.error);
