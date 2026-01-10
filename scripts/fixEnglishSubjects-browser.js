/**
 * 브라우저 콘솔에서 실행할 영어 수업 subject 수정 스크립트
 *
 * 사용 방법:
 * 1. 브라우저에서 앱 열기 (로그인 상태)
 * 2. F12로 개발자 도구 열기
 * 3. Console 탭에서 이 스크립트 전체를 복사해서 붙여넣기
 * 4. Enter 키로 실행
 */

(async function fixEnglishSubjects() {
  console.log('🚀 영어 수업 subject 수정 시작\n');

  // Firebase는 이미 웹앱에서 초기화되어 있음
  const { collection, getDocs, collectionGroup, doc, updateDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

  // firebaseConfig에서 db 가져오기 (전역 변수로 노출되어 있을 것)
  if (typeof db === 'undefined') {
    console.error('❌ Firebase db를 찾을 수 없습니다. 앱이 로드된 상태에서 실행하세요.');
    return;
  }

  const stats = {
    total: 0,
    math: 0,
    english: 0,
    updated: 0,
    errors: []
  };

  /**
   * 과목 추론
   */
  function inferSubject(className) {
    const englishPatterns = [
      /^DP/, /^PL/, /^LE/, /^RTT/, /^RW/, /^GR/, /^VT/,
      /^E_/, /phonics/i, /grammar/i, /reading/i, /writing/i,
      /초등\s*브릿지/, /중등E/
    ];

    return englishPatterns.some(p => p.test(className)) ? 'english' : 'math';
  }

  try {
    // 모든 enrollments 조회
    console.log('📋 enrollments 조회 중...');
    const snapshot = await getDocs(collectionGroup(db, 'enrollments'));
    stats.total = snapshot.docs.length;

    console.log(`발견된 enrollments: ${stats.total}개\n`);

    for (const enrollmentDoc of snapshot.docs) {
      const data = enrollmentDoc.data();
      const currentSubject = data.subject || 'math';
      const className = data.className || '';
      const studentId = enrollmentDoc.ref.parent.parent?.id || 'unknown';

      const inferredSubject = inferSubject(className);

      // 통계
      if (currentSubject === 'math') stats.math++;
      else stats.english++;

      // 수정 필요한 경우
      if (currentSubject !== inferredSubject) {
        try {
          console.log(`🔄 ${className} (${studentId}): ${currentSubject} → ${inferredSubject}`);

          await updateDoc(enrollmentDoc.ref, {
            subject: inferredSubject,
            updatedAt: Timestamp.now(),
            subjectFixedAt: Timestamp.now()
          });

          stats.updated++;
        } catch (error) {
          const msg = `${className}: ${error.message}`;
          console.error(`❌ ${msg}`);
          stats.errors.push(msg);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 수정 결과');
    console.log('='.repeat(60));
    console.log(`총 enrollments: ${stats.total}개`);
    console.log(`수학: ${stats.math}개`);
    console.log(`영어: ${stats.english}개`);
    console.log(`영어로 수정: ${stats.updated}개`);
    console.log(`에러: ${stats.errors.length}개`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️ 에러:');
      stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    console.log('='.repeat(60));
    console.log('\n✅ 완료! 페이지를 새로고침하세요.');

  } catch (error) {
    console.error('❌ 오류:', error);
  }
})();
