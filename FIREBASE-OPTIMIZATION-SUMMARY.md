# Firebase 비용 최적화 즉시 실행 가이드

**분석일:** 2026-01-12
**예상 절감:** 월 $16-24 (현재 대비 -60%)
**작업 시간:** 6-8시간
**위험도:** 낮음

---

## 즉시 적용 필요 (Phase 1)

### 1. usePermissions.ts 최적화 ⚡ HIGH PRIORITY

**문제:**
- onSnapshot으로 권한 설정 실시간 구독
- 월 18,000 reads (불필요한 재구독)

**해결:**
- React Query로 전환 + 30분 캐싱

**절감 효과:** -73% ($4-6/월)

**작업 파일:**
```
f:\ijw-calander\hooks\usePermissions.ts
```

**변경 내용:**
1. onSnapshot 제거
2. useQuery로 getDoc 호출
3. staleTime: 30분 설정
4. mutation 시 invalidateQueries

**예상 시간:** 2시간

---

### 2. App.tsx 이벤트 구독 최적화 ⚡ HIGH PRIORITY

**문제:**
- 전체 events 컬렉션 실시간 구독
- 월 301,000 reads (매우 높음!)

**해결:**
- React Query로 전환
- 최근 2년 이벤트만 조회 (where 필터)
- 5분 캐싱

**절감 효과:** -83% ($7-10/월)

**작업 파일:**
```
f:\ijw-calander\App.tsx (라인 200번 이후 추정)
```

**변경 내용:**
1. onSnapshot 제거
2. useQuery + getDocs
3. where('startDate', '>=', cutoffDate) 추가
4. staleTime: 5분

**예상 시간:** 4시간

---

### 3. useClasses.ts subject 필터 추가 🟡 MEDIUM PRIORITY

**문제:**
- collectionGroup으로 전체 enrollments 스캔
- 월 864,000 reads

**해결:**
- subject 파라미터가 있을 때 where 필터 적용

**절감 효과:** -50% ($5-8/월)

**작업 파일:**
```
f:\ijw-calander\hooks\useClasses.ts (라인 92-102)
```

**변경 내용:**
```typescript
// 기존
const enrollmentsQuery = query(collectionGroup(db, 'enrollments'));

// 개선
const enrollmentsQuery = subject
    ? query(collectionGroup(db, 'enrollments'), where('subject', '==', subject))
    : query(collectionGroup(db, 'enrollments'));
```

**예상 시간:** 30분

---

## 테스트 체크리스트

### usePermissions 테스트
- [ ] 로그인 시 권한 정상 로드
- [ ] 권한 변경 시 즉시 반영
- [ ] 페이지 새로고침 시 캐시 사용
- [ ] 마스터 권한으로 권한 수정 테스트

### App.tsx events 테스트
- [ ] 캘린더 초기 로드 시 이벤트 표시
- [ ] 이벤트 추가/수정/삭제 시 즉시 반영
- [ ] 5분 내 재방문 시 캐시 사용
- [ ] 다년간 이벤트 필터링 정상 동작

### useClasses 테스트
- [ ] 수학 시간표 정상 표시
- [ ] 영어 시간표 정상 표시
- [ ] 클래스 목록 필터링 정상 동작

---

## 구현 순서

1. **usePermissions.ts** (2시간)
   - 가장 간단하고 위험도 낮음
   - 다른 컴포넌트에 영향 적음

2. **useClasses.ts** (30분)
   - 코드 변경 최소 (5줄)
   - 즉시 테스트 가능

3. **App.tsx events** (4시간)
   - 가장 복잡하지만 효과 큰
   - 충분한 테스트 필요

---

## 위험 관리

### 낮은 위험 (안전하게 적용 가능)
- usePermissions.ts
- useClasses.ts subject 필터

### 중간 위험 (테스트 환경 먼저)
- App.tsx events 구독 제거

### 롤백 플랜
```bash
# Git으로 버전 관리
git checkout -b firebase-optimization-phase1
git add hooks/usePermissions.ts hooks/useClasses.ts App.tsx
git commit -m "feat: Firebase cost optimization Phase 1"

# 문제 발생 시
git revert HEAD
```

---

## 성공 지표

### Firebase Console에서 확인
1. **Document Reads (월간)**
   - 현재: ~1,200,000 reads
   - 목표: ~500,000 reads (-60%)

2. **비용**
   - 현재: $35-40/월
   - 목표: $15-20/월 (-60%)

### 측정 방법
```
Firebase Console → Firestore → Usage
기간: 최근 7일 → 30일로 확장
적용 전후 비교
```

---

## 다음 단계 (Phase 2)

Phase 1 성공 후 1주일 내 적용:

1. **Firestore 복합 인덱스 생성** (1시간)
   - enrollments: subject + status + className
   - 추가 -20% 절감

2. **영어 시간표 설정 최적화** (2시간)
   - useEnglishSettings.ts 확인 및 React Query 전환

---

## 도움이 필요한 경우

### 상세 보고서 위치
```
f:\ijw-calander\docs\reports\firebase-cost-optimization-comprehensive-2026-01-12.md
```

### 코드 스니펫
상세 보고서의 "코드 스니펫 모음" 섹션 참고

### 문제 발생 시
1. Git 롤백
2. 기존 보고서 참고
3. React Query Devtools로 캐시 상태 확인

---

**작성:** 2026-01-12
**우선순위:** ⚡ HIGH
**예상 ROI:** $16-24/월 절감 (6-8시간 작업)
