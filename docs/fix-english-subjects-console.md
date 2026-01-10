# 영어 수업 Subject 수정 가이드

## 문제
모든 enrollments의 `subject`가 'math'로 저장되어 있어, 영어 수업이 수학 탭에 표시됨

## 해결 방법 (브라우저 콘솔 사용)

### 1단계: 브라우저 개발자 도구 열기
1. 앱에서 F12 키 누르기
2. Console 탭 선택

### 2단계: 아래 스크립트 복사 & 실행

```javascript
// 영어 수업 subject 수정 스크립트
(async function() {
  console.log('🚀 영어 수업 subject 수정 시작\n');

  // 앱의 Firestore 모듈 동적 import
  let db, collectionGroup, getDocs, updateDoc, Timestamp;
  try {
    const firestoreModule = await import('firebase/firestore');
    const configModule = await import('/firebaseConfig.ts?t=' + Date.now());

    db = configModule.db;
    collectionGroup = firestoreModule.collectionGroup;
    getDocs = firestoreModule.getDocs;
    updateDoc = firestoreModule.updateDoc;
    Timestamp = firestoreModule.Timestamp;

    console.log('✅ Firebase 모듈 로드 성공\n');
  } catch (e) {
    console.error('❌ Firebase를 불러올 수 없습니다:', e);
    console.log('💡 해결방법: 페이지를 새로고침한 후 다시 시도하세요.');
    return;
  }

  const stats = { total: 0, math: 0, english: 0, updated: 0, errors: [] };

  // 과목 추론 함수
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
    console.log(`발견: ${stats.total}개\n`);

    for (const enrollmentDoc of snapshot.docs) {
      const data = enrollmentDoc.data();
      const currentSubject = data.subject || 'math';
      const className = data.className || '';
      const studentId = enrollmentDoc.ref.parent.parent?.id || 'unknown';
      const inferredSubject = inferSubject(className);

      // 통계
      if (currentSubject === 'math') stats.math++; else stats.english++;

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
          console.error(`❌ ${className}: ${error.message}`);
          stats.errors.push(`${className}: ${error.message}`);
        }
      }
    }

    // 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 결과');
    console.log('='.repeat(60));
    console.log(`총: ${stats.total}개`);
    console.log(`수학: ${stats.math}개`);
    console.log(`영어: ${stats.english}개`);
    console.log(`영어로 수정: ${stats.updated}개`);
    console.log(`에러: ${stats.errors.length}개`);
    console.log('='.repeat(60));
    console.log('\n✅ 완료! 페이지 새로고침 필요');

  } catch (error) {
    console.error('❌ 오류:', error);
  }
})();
```

### 3단계: 결과 확인
- 콘솔에 "영어로 수정: X개" 메시지 확인
- 브라우저 새로고침 (F5)
- 수업 배정 모달 열어서 확인

## 대안: NPM 스크립트 (권한 문제 시)

만약 위 방법이 안 되면, Firebase 콘솔에서 직접 수정:

1. https://console.firebase.google.com
2. Firestore Database 선택
3. students/{studentId}/enrollments 찾기
4. className이 영어 패턴인 문서 찾기 (DP, PL, LE, E_, 등)
5. subject 필드를 'english'로 수정

## 영어 수업 패턴
- DP, PL, LE, RTT, RW, GR, VT로 시작
- E_로 시작
- "초등 브릿지", "중등E" 포함
- phonics, grammar, reading, writing 포함
