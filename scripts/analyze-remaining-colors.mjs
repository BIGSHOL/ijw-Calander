#!/usr/bin/env node

import { readFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 알려진 색상 hex 값 (변환 완료)
const CONVERTED_COLORS = [
  '#081429', // primary
  '#fdb813', // accent
  '#373d41', // primary-700
  '#10b981', // success
  '#ef4444', // error
  '#f59e0b', // warning
  '#3b82f6', // info
  '#0a1a35', // primary-800
  '#102a43', // primary-900
  '#e5a610', // accent-600
];

const COLOR_HEX_REGEX = /#[0-9a-fA-F]{6}\b/g;
const INLINE_STYLE_REGEX = /(backgroundColor|color|borderColor):\s*['"`]?(#[0-9a-fA-F]{6})/g;

async function analyzeRemainingColors() {
  console.log('🔍 남은 하드코딩 색상 분석 중...\n');

  const files = await glob('components/**/*.{tsx,ts}', {
    cwd: rootDir,
    absolute: true
  });

  const results = {
    inlineStyles: new Map(),
    otherHexColors: new Map(),
    filesByType: {
      inlineStyles: new Set(),
      otherHex: new Set(),
    }
  };

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const relativePath = file.replace(rootDir + '\\', '').replace(/\\/g, '/');

    // 인라인 스타일 색상 찾기
    const inlineMatches = [...content.matchAll(INLINE_STYLE_REGEX)];
    if (inlineMatches.length > 0) {
      results.filesByType.inlineStyles.add(relativePath);
      inlineMatches.forEach(match => {
        const [fullMatch, property, color] = match;
        const key = `${property}: ${color}`;
        if (!results.inlineStyles.has(key)) {
          results.inlineStyles.set(key, []);
        }
        results.inlineStyles.get(key).push(relativePath);
      });
    }

    // 기타 hex 색상 찾기 (변환되지 않은 것)
    const hexMatches = [...content.matchAll(COLOR_HEX_REGEX)];
    const unconvertedHex = hexMatches
      .map(m => m[0].toLowerCase())
      .filter(hex => !CONVERTED_COLORS.map(c => c.toLowerCase()).includes(hex));

    if (unconvertedHex.length > 0) {
      results.filesByType.otherHex.add(relativePath);
      unconvertedHex.forEach(hex => {
        if (!results.otherHexColors.has(hex)) {
          results.otherHexColors.set(hex, []);
        }
        if (!results.otherHexColors.get(hex).includes(relativePath)) {
          results.otherHexColors.get(hex).push(relativePath);
        }
      });
    }
  }

  // 보고서 출력
  console.log('📊 분석 결과\n');

  console.log('1️⃣ 인라인 스타일 색상 (동적 값, 수동 검토 필요)');
  console.log(`   총 ${results.inlineStyles.size}가지 패턴, ${results.filesByType.inlineStyles.size}개 파일\n`);

  const inlineEntries = [...results.inlineStyles.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  inlineEntries.slice(0, 15).forEach(([pattern, files]) => {
    console.log(`   ${pattern} (${files.length}개 파일)`);
  });

  if (inlineEntries.length > 15) {
    console.log(`   ... 외 ${inlineEntries.length - 15}개 패턴\n`);
  } else {
    console.log('');
  }

  console.log('2️⃣ 기타 Hex 색상 (설정 값, 사용자 정의 등)');
  console.log(`   총 ${results.otherHexColors.size}가지 색상, ${results.filesByType.otherHex.size}개 파일\n`);

  const hexEntries = [...results.otherHexColors.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  hexEntries.slice(0, 20).forEach(([color, files]) => {
    console.log(`   ${color} (${files.length}개 파일)`);
  });

  if (hexEntries.length > 20) {
    console.log(`   ... 외 ${hexEntries.length - 20}개 색상\n`);
  } else {
    console.log('');
  }

  // 특수 케이스 파일 목록
  console.log('⚠️  수동 검토 필요 파일 (인라인 스타일):\n');
  const inlineFiles = [...results.filesByType.inlineStyles].slice(0, 10);
  inlineFiles.forEach(file => {
    console.log(`   - ${file}`);
  });
  if (results.filesByType.inlineStyles.size > 10) {
    console.log(`   ... 외 ${results.filesByType.inlineStyles.size - 10}개 파일`);
  }

  console.log('\n✅ 분석 완료!');
  console.log('\n💡 권장사항:');
  console.log('   - 인라인 스타일 색상은 대부분 동적 값 (사용자 설정, API 데이터 등)');
  console.log('   - constants.ts 등의 설정 파일 색상은 유지');
  console.log('   - 실제 UI에서 사용되는 정적 색상만 추가 변환 고려');

  return results;
}

analyzeRemainingColors().catch(console.error);
