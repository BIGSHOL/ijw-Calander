/**
 * 키워드 색상 → 수업 직접 색상 마이그레이션
 *
 * 사용법 (브라우저 콘솔, master/admin 계정 로그인 상태):
 *   1. dry-run (변경 미리보기):
 *      await window.migrateKeywordColorsToClasses()
 *   2. 실제 실행:
 *      await window.migrateKeywordColorsToClasses({ apply: true })
 *
 * 동작:
 * - classKeywords 컬렉션의 모든 키워드를 order 순으로 정렬
 * - classes 컬렉션에서 isActive=true인 모든 수업을 가져옴
 * - 각 수업에 대해 첫 매칭 키워드를 찾아 bgColor/textColor를 수업 문서에 직접 저장
 * - 이미 bgColor가 있는 수업은 건드리지 않음 (사용자가 수동 설정한 색상 보존)
 * - 미매칭 수업은 그대로 둠 (회색 기본값)
 *
 * 결과:
 * - 마이그레이션 직후 시간표 색상은 100% 동일하게 유지되어야 함
 *   (Phase 2 매칭 로직: 직접 색상 우선, 없으면 키워드 폴백)
 */
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface ClassKeywordDoc {
  id: string;
  keyword: string;
  bgColor: string;
  textColor: string;
  order?: number;
}

interface ClassDoc {
  id: string;
  className?: string;
  subject?: string;
  isActive?: boolean;
  bgColor?: string;
  textColor?: string;
  [key: string]: any;
}

interface MigrationPreview {
  classId: string;
  className: string;
  subject: string;
  matchedKeywordId: string | null;
  matchedKeyword: string | null;
  bgColor: string | null;
  textColor: string | null;
  // 진단용
  alternativeMatches: string[];  // 매칭 가능한 다른 키워드들 (충돌 의심)
  hasExistingColor: boolean;     // 이미 색상이 설정되어 있어 건너뜀
}

interface MigrationResult {
  totalActive: number;
  matched: number;
  unmatched: number;
  skippedExisting: number;
  multipleMatches: number;
  applied: number;
  preview: MigrationPreview[];
}

export async function migrateKeywordColorsToClasses(
  opts: { apply?: boolean } = {}
): Promise<MigrationResult> {
  const apply = !!opts.apply;
  console.log(
    `🎨 키워드 → 수업 색상 마이그레이션 ${apply ? '(APPLY MODE)' : '(DRY-RUN)'} 시작...`
  );

  // 1. classKeywords 로드 (order 순)
  const keywordSnap = await getDocs(collection(db, 'classKeywords'));
  const keywords: ClassKeywordDoc[] = keywordSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((k) => k.keyword && k.bgColor)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  console.log(`📚 classKeywords 로드: ${keywords.length}개`);
  if (keywords.length === 0) {
    console.warn('⚠️ classKeywords가 비어있습니다. 마이그레이션할 항목 없음.');
    return {
      totalActive: 0,
      matched: 0,
      unmatched: 0,
      skippedExisting: 0,
      multipleMatches: 0,
      applied: 0,
      preview: [],
    };
  }

  // 2. classes 로드 (isActive=true만)
  const classesSnap = await getDocs(collection(db, 'classes'));
  const allClasses: ClassDoc[] = classesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) })
  );
  const activeClasses = allClasses.filter((c) => c.isActive !== false);
  console.log(
    `📦 classes 로드: 전체 ${allClasses.length}개, 활성 ${activeClasses.length}개`
  );

  // 3. 매칭 분석
  const preview: MigrationPreview[] = [];
  let matched = 0;
  let unmatched = 0;
  let skippedExisting = 0;
  let multipleMatches = 0;

  for (const cls of activeClasses) {
    const className = cls.className || '';
    const hasExisting = !!cls.bgColor;

    // 모든 매칭 키워드 (order 순)
    const allMatched = keywords.filter((kw) => className.includes(kw.keyword));
    const firstMatch = allMatched[0] || null;
    const altMatches = allMatched.slice(1).map((k) => k.keyword);

    if (allMatched.length > 1) multipleMatches++;

    if (hasExisting) {
      // 이미 색상이 있으면 건너뜀 (사용자 수동 설정 보존)
      skippedExisting++;
      preview.push({
        classId: cls.id,
        className,
        subject: cls.subject || '',
        matchedKeywordId: firstMatch?.id || null,
        matchedKeyword: firstMatch?.keyword || null,
        bgColor: null,
        textColor: null,
        alternativeMatches: altMatches,
        hasExistingColor: true,
      });
      continue;
    }

    if (firstMatch) {
      matched++;
      preview.push({
        classId: cls.id,
        className,
        subject: cls.subject || '',
        matchedKeywordId: firstMatch.id,
        matchedKeyword: firstMatch.keyword,
        bgColor: firstMatch.bgColor,
        textColor: firstMatch.textColor,
        alternativeMatches: altMatches,
        hasExistingColor: false,
      });
    } else {
      unmatched++;
      preview.push({
        classId: cls.id,
        className,
        subject: cls.subject || '',
        matchedKeywordId: null,
        matchedKeyword: null,
        bgColor: null,
        textColor: null,
        alternativeMatches: [],
        hasExistingColor: false,
      });
    }
  }

  // 4. 결과 출력
  console.log('📊 매칭 분석 결과:');
  console.log(`   - 활성 수업: ${activeClasses.length}개`);
  console.log(`   - 매칭됨: ${matched}개`);
  console.log(`   - 미매칭: ${unmatched}개`);
  console.log(`   - 이미 색상 있어 건너뜀: ${skippedExisting}개`);
  console.log(`   - 다중 매칭(첫 번째 사용): ${multipleMatches}개`);

  // 4-1. 다중 매칭 수업 표시
  const multi = preview.filter((p) => p.alternativeMatches.length > 0);
  if (multi.length > 0) {
    console.log('⚠️ 다중 매칭 케이스 (order 가장 작은 키워드 사용):');
    console.table(
      multi.map((p) => ({
        className: p.className,
        선택된키워드: p.matchedKeyword,
        다른후보: p.alternativeMatches.join(', '),
        bgColor: p.bgColor,
      }))
    );
  }

  // 4-2. 미매칭 수업 표시
  const unm = preview.filter((p) => !p.matchedKeyword && !p.hasExistingColor);
  if (unm.length > 0) {
    console.log(`📝 미매칭 수업 (${unm.length}개) - 회색 기본값으로 표시됨:`);
    console.table(
      unm.map((p) => ({ className: p.className, subject: p.subject }))
    );
  }

  // 4-3. 매칭 결과 샘플 출력 (최대 30개)
  const matchedPreview = preview.filter((p) => p.bgColor);
  if (matchedPreview.length > 0) {
    console.log(
      `✅ 매칭 결과 샘플 (${Math.min(30, matchedPreview.length)} / ${matchedPreview.length}):`
    );
    console.table(
      matchedPreview.slice(0, 30).map((p) => ({
        className: p.className,
        subject: p.subject,
        키워드: p.matchedKeyword,
        bgColor: p.bgColor,
        textColor: p.textColor,
      }))
    );
  }

  // 5. 백업 (브라우저 메모리)
  const backupPayload = {
    timestamp: new Date().toISOString(),
    keywords,
    classes_before: allClasses,
    preview,
    summary: {
      totalActive: activeClasses.length,
      matched,
      unmatched,
      skippedExisting,
      multipleMatches,
    },
  };
  // window에 백업 부착 (콘솔에서 다운로드 가능)
  if (typeof window !== 'undefined') {
    (window as any).__migrationBackup = backupPayload;
    console.log(
      '💾 백업 데이터: window.__migrationBackup 으로 접근 가능 (JSON.stringify해서 저장 권장)'
    );
  }

  if (!apply) {
    console.log('💡 dry-run 완료. 실제 적용:');
    console.log('   await window.migrateKeywordColorsToClasses({ apply: true })');
    return {
      totalActive: activeClasses.length,
      matched,
      unmatched,
      skippedExisting,
      multipleMatches,
      applied: 0,
      preview,
    };
  }

  // 6. 실제 적용 (writeBatch, 500개씩)
  const toApply = preview.filter((p) => p.bgColor && !p.hasExistingColor);
  console.log(`🚀 ${toApply.length}개 수업에 색상 적용 시작...`);

  let applied = 0;
  const BATCH_SIZE = 400; // Firestore 한도 500보다 여유
  for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
    const chunk = toApply.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((p) => {
      const ref = doc(db, 'classes', p.classId);
      batch.update(ref, {
        bgColor: p.bgColor,
        textColor: p.textColor,
        updatedAt: new Date().toISOString(),
      });
    });
    try {
      await batch.commit();
      applied += chunk.length;
      console.log(`   ✓ ${applied} / ${toApply.length} 완료`);
    } catch (err) {
      console.error('❌ batch commit 실패:', err);
      console.error('실패한 수업:', chunk.map((c) => c.className));
      throw err;
    }
  }

  console.log(`✅ 마이그레이션 완료: ${applied}개 수업에 색상 적용`);
  console.log('🔍 다음: 시간표를 새로고침하여 시각 검증을 수행하세요.');

  return {
    totalActive: activeClasses.length,
    matched,
    unmatched,
    skippedExisting,
    multipleMatches,
    applied,
    preview,
  };
}
