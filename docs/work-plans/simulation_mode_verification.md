# 영어 시간표 시뮬레이션 모드 검증 결과

**검증일**: 2025-12-31
**검증 대상**: 시뮬레이션 모드 기능 및 문서
**검증자**: code-reviewer, firebase-cost-optimizer, report-analyst

---

## 📊 종합 평가

| 항목 | 점수 | 상태 |
|------|------|------|
| 코드 품질 | 3.5/5 | 🟡 개선 필요 |
| Firebase 비용 | 4/5 | 🟢 양호 (최적화 여지 있음) |
| 문서 완성도 | 4/5 | 🟢 양호 (보완 완료) |
| **종합** | **3.8/5** | 🟡 **개선 권장** |

---

## 🚨 Critical 이슈 (즉시 수정 필요)

### 1. targetCollection 버그 🔴

**파일**: `components/Timetable/English/EnglishTeacherTab.tsx`
**위치**: 라인 488, 504, 550

**문제**:
```typescript
// 현재 (잘못됨)
await setDoc(doc(db, EN_COLLECTION, teacherName), ...);

// 수정 필요
await setDoc(doc(db, targetCollection, teacherName), ...);
```

**영향**:
- 시뮬레이션 모드에서 편집 시 Live 데이터가 수정됨
- 시뮬레이션 모드의 핵심 가치 훼손
- 데이터 손실 위험

**수정 대상 함수**:
1. `handleBatchSave` (라인 488)
2. `handleBatchDelete` (라인 504, 550)

**우선순위**: P0 (최우선)

---

### 2. 리스너 의존성 배열 누락 🔴

**파일**: `components/Timetable/English/EnglishTimetable.tsx`
**위치**: 라인 79

**문제**:
```typescript
// 현재 (잘못됨)
useEffect(() => {
    const targetCollection = isSimulationMode ? EN_DRAFT_COLLECTION : EN_COLLECTION;
    const unsubscribe = onSnapshot(collection(db, targetCollection), ...);
    return () => unsubscribe();
}, []); // ❌ 빈 배열

// 수정 필요
}, [isSimulationMode]); // ✅ 의존성 추가
```

**영향**:
- 모드 전환 시 리스너가 재구독되지 않음
- 실시간 모드 ↔ 시뮬레이션 모드 전환 시 잘못된 데이터 표시
- 사용자 혼란 유발

**우선순위**: P0 (최우선)

---

## 🟡 High Priority 이슈

### 3. EnglishClassTab 수업목록 전체 스캔

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
**위치**: 라인 141-184

**문제**:
- 전체 수업목록(80개)을 구독하고 클라이언트에서 필터링
- 필요한 수업은 20개뿐

**비용 영향**:
- 일일 800건 불필요한 읽기 (전체의 33%)
- 연간 $1.31 낭비

**해결 방안**:
```typescript
// WHERE IN 쿼리 사용 (10개씩 배치)
const batches = [];
for (let i = 0; i < classNamesArray.length; i += 10) {
    batches.push(classNamesArray.slice(i, i + 10));
}

const unsubscribes = batches.map(batch => {
    const q = query(
        collection(db, '수업목록'),
        where('className', 'in', batch)
    );
    return onSnapshot(q, ...);
});
```

**예상 절감**: 600건/일 (-75%)

**우선순위**: P1 (높음)

---

### 4. 레벨 설정 중복 구독

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
**위치**: ClassCard 컴포넌트 (라인 882-890)

**문제**:
- 각 수업 카드(20개)마다 동일한 `settings/english_levels` 문서를 구독
- 실제로는 한 번만 구독하면 됨

**비용 영향**:
- 일일 190건 중복 읽기
- 연간 $0.42 낭비

**해결 방안**:
- 부모 컴포넌트에서 한 번만 구독
- ClassCard에 props로 전달

**예상 절감**: 190건/일 (-95%)

**우선순위**: P1 (높음)

---

### 5. LevelUpConfirmModal 하드코딩

**파일**: `components/Timetable/English/LevelUpConfirmModal.tsx`
**위치**: 라인 40, 59

**문제**:
```typescript
const schedulesRef = collection(db, EN_COLLECTION); // 하드코딩
```

**영향**:
- 시뮬레이션 모드에서 레벨업 실행 시 Live 데이터 수정

**해결 방안**:
- `targetCollection` prop 추가
- EnglishClassTab → LevelUpConfirmModal로 전달

**우선순위**: P1 (높음)

---

## 🟢 Medium Priority 개선사항

### 6. Draft 컬렉션 완전 삭제 로직 부재

**현황**:
- "현재 상태 가져오기" 시 덮어쓰기만 수행
- Draft에만 존재하는 문서는 삭제되지 않음

**권장 개선**:
```typescript
// 1. Draft 전체 삭제
const draftSnapshot = await getDocs(collection(db, EN_DRAFT_COLLECTION));
const batch1 = writeBatch(db);
draftSnapshot.docs.forEach(doc => batch1.delete(doc.ref));
await batch1.commit();

// 2. Live 복사
const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));
const batch2 = writeBatch(db);
liveSnapshot.docs.forEach(docSnap => {
    batch2.set(doc(db, EN_DRAFT_COLLECTION, docSnap.id), docSnap.data());
});
await batch2.commit();
```

**우선순위**: P2 (중간)

---

### 7. StudentModal 전체 수업목록 스캔

**파일**: `components/Timetable/English/StudentModal.tsx`
**위치**: 라인 65-66

**문제**:
- WHERE 절이 있지만 인덱스 없으면 전체 스캔 가능성
- 매번 최대 80건 읽기

**해결 방안**:
1. Firestore 인덱스 생성: `수업목록.className`
2. 또는 문서 ID를 className으로 변경 → `getDoc` 1건만 읽기

**예상 절감**: 395건/일 (-98.8%)

**우선순위**: P2 (중간)

---

## 📈 비용 최적화 요약

### 현재 상태 (사용자 10명 기준)
- 일일 읽기: 2,415건
- 월간 읽기: 72,450건
- 무료 할당량 대비: **4.8%** 🟢
- 무료 한계 도달: 207명

### 최적화 후 예상
- 일일 읽기: 835건 (-65.4%)
- 월간 읽기: 25,050건
- 무료 할당량 대비: **1.7%** 🟢
- 무료 한계 도달: 599명 (+190%)

### 단계별 개선 효과

| Phase | 작업 | 절감 | 소요 시간 |
|-------|------|------|---------|
| Phase 1 | 리스너 의존성 + 중복 구독 제거 + WHERE IN | 790건/일 (-32.7%) | 2-3시간 |
| Phase 2 | Firestore 인덱스 생성 | +395건/일 (-16.4%) | 30분 |
| Phase 3 | 문서 ID 구조 개선 | +395건/일 (-16.3%) | 2-3일 |
| **합계** | | **1,580건/일 (-65.4%)** | |

---

## 📝 문서 개선 완료 사항

### 추가된 섹션

1. **섹션 2.4 - UI/UX 상세 명세**
   - 시각적 구분 요소 표
   - 버튼 배치 및 스타일 가이드
   - 로딩 상태 표시 방법

2. **섹션 2.5 - 권한 및 접근 제어 (RBAC)**
   - 기능별 필요 권한 명시
   - 구현 코드 예시

3. **섹션 3.3 - 데이터 동기화 메커니즘**
   - onSnapshot 동작 흐름 설명
   - 장점 및 주의사항

4. **섹션 5 - 에러 처리 및 제약사항**
   - 5.1 에러 처리
   - 5.2 알려진 이슈 (Known Issues)
   - 5.3 제약사항 표

### 보강된 내용

1. **섹션 3.2 - 컴포넌트 구조 변경**
   - 실제 코드 스니펫 추가
   - EnglishClassTab/RoomTab 처리 방법 명시
   - useEffect 의존성 배열 중요성 강조

2. **섹션 2.2 - 데이터 제어 기능**
   - 권한 요구사항 명시
   - 확인 프롬프트 메시지 추가
   - "반영 후 자동 모드 전환" 동작 기재

3. **섹션 6 - 향후 고려사항**
   - 비용 최적화 항목 추가
   - Draft 완전 삭제 기능 추가

---

## ✅ 수정 우선순위 체크리스트

### 즉시 (오늘, 1시간)
- [x] `EnglishTimetable.tsx:79` - useEffect 의존성에 `isSimulationMode` 추가 ✅
- [x] `EnglishTeacherTab.tsx:488` - `EN_COLLECTION` → `targetCollection` 변경 ✅
- [x] `EnglishTeacherTab.tsx:504` - `EN_COLLECTION` → `targetCollection` 변경 ✅
- [x] `EnglishTeacherTab.tsx:550` - `EN_COLLECTION` → `targetCollection` 변경 ✅

### 단기 (이번 주, 3-4시간)
- [x] `EnglishClassTab.tsx:882-890` - 레벨 설정 구독을 부모로 이동 ✅
- [x] `EnglishClassTab.tsx:141-184` - 수업목록 WHERE IN 쿼리 변경 ✅
- [ ] `LevelUpConfirmModal.tsx` - targetCollection prop 추가 및 사용

### 중기 (이번 달, 1-2일)
- [ ] Firebase Console - `수업목록.className` 인덱스 생성
- [ ] `EnglishTimetable.tsx` - Draft 완전 삭제 로직 추가
- [ ] 시뮬레이션 모드 전체 통합 테스트 실시

---

## 🎯 다음 단계 권장사항

### 1. Critical 이슈 즉시 수정
**대상**: Issue #1, #2
**예상 소요**: 30분
**담당**: 개발팀

### 2. code-fixer 에이전트 실행
**목적**: 자동 코드 개선
**대상**: 위 체크리스트의 "즉시" 항목
**예상 소요**: 1시간

### 3. Firebase 비용 최적화 Phase 1
**목적**: 연간 $1.73 절약 + 확장성 49% 향상
**대상**: 중복 구독 제거, WHERE IN 쿼리
**예상 소요**: 3시간

### 4. 통합 테스트
**시나리오**:
- [ ] 실시간 → 시뮬레이션 모드 전환 (데이터 올바르게 표시되는지)
- [ ] 시뮬레이션 모드에서 편집 (Draft에만 저장되는지)
- [ ] 현재 상태 가져오기 (확인 프롬프트 + 복사 성공)
- [ ] 실제 반영 (Master 권한 + 확인 프롬프트 + Live 업데이트)
- [ ] 모드 전환 반복 (메모리 누수 없는지)

---

## 📚 참고 자료

- 원본 문서: `docs/work-plans/english_timetable_simulation_mode.md`
- 상세 코드 리뷰: code-reviewer 에이전트 결과 (agentId: a921d0e)
- 비용 최적화: firebase-cost-optimizer 에이전트 결과 (agentId: a9541d4)
- 문서 분석: report-analyst 에이전트 결과 (agentId: abd241f)

---

**최종 권장사항**: Critical 이슈 2개를 우선 수정한 후, Phase 1 최적화를 진행하면 안정적이고 비용 효율적인 시뮬레이션 모드를 운영할 수 있습니다.
