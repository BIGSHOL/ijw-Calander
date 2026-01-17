# Firebase 비용 분석 보고서

**작성일**: 2026-01-17
**분석 범위**: hooks/, components/ 디렉토리의 Firebase 사용 패턴

---

## 1. 현재 Firebase 사용 현황

### 1.1 실시간 구독 (onSnapshot) 사용처

| 파일 | 위치 | 구독 대상 | 비용 영향 | 필요성 |
|-----|-----|---------|---------|-------|
| App.tsx:393 | 유저 프로필 | `users/{userId}` | 🟢 낮음 | ✅ 필수 (인증) |
| App.tsx:480 | 전체 유저 목록 | `users` 컬렉션 | 🟡 중간 | ❓ 검토 필요 |
| App.tsx:692 | 이벤트 | `events` 컬렉션 | 🟡 중간 | ✅ 캘린더 실시간 |
| App.tsx:723 | 버킷 아이템 | `bucketItems` | 🟢 낮음 | ✅ 실시간 필요 |
| useTimetableClasses.ts:61 | 수업 목록 | `classes` 컬렉션 | 🟡 중간 | ❓ 검토 필요 |
| useTimetableClasses.ts:142 | 레거시 수업 | `수업목록` 컬렉션 | 🟢 낮음 | ⚠️ 제거 예정 |
| useMathClassStudents.ts:57 | 수학 등록 | `enrollments` collectionGroup | 🔴 **높음** | ❓ 검토 필요 |
| useClassStudents.ts:58 | 영어 등록 | `enrollments` collectionGroup | 🔴 **높음** | ❓ 검토 필요 |
| useEnglishStats.ts:63 | 영어 통계 | `enrollments` collectionGroup | 🔴 **높음** | ❓ 검토 필요 |
| EnglishTimetable.tsx:65 | 영어 임시저장 | `englishTimetableDraft` | 🟢 낮음 | ✅ 편집 실시간 |
| EnglishTimetable.tsx:150 | 영어 시간표 | `englishTimetable` | 🟡 중간 | ✅ 시간표 실시간 |
| ClassSettingsModal.tsx:51 | 키워드 | `classKeywords` | 🟢 낮음 | ⚠️ 모달 열릴 때만 |
| RoleManagementPage.tsx:203 | 권한 설정 | `settings/rolePermissions` | 🟢 낮음 | ⚠️ 페이지 열릴 때만 |
| StudentModal.tsx:177 | 학생 상세 | 단일 문서 | 🟢 낮음 | ✅ 모달 실시간 |

### 1.2 비용 등급 분류

- 🟢 **낮음**: 단일 문서 또는 소규모 컬렉션
- 🟡 **중간**: 수십~수백 개 문서 컬렉션
- 🔴 **높음**: collectionGroup 또는 대규모 컬렉션

---

## 2. 주요 비용 발생 지점

### 2.1 🔴 collectionGroup 쿼리 (가장 비용 높음)

```
위치: useMathClassStudents.ts, useClassStudents.ts, useEnglishStats.ts
쿼리: collectionGroup(db, 'enrollments')
문제: 전체 enrollments 서브컬렉션을 스캔
```

**현재 구조**:
```
students/{studentId}/enrollments/{enrollmentId}
```

**비용 계산** (학생 300명, 평균 2개 등록):
- 전체 enrollments: ~600개 문서
- onSnapshot 1회 = 600 읽기
- 변경될 때마다 = 추가 읽기
- **하루 예상**: 600 × 10회 = 6,000 읽기 (enrollments만)

### 2.2 🟡 N+1 쿼리 패턴

```typescript
// useStudents.ts:42
for (const student of students) {
    const enrollmentsSnap = await getDocs(
        collection(db, 'students', student.id, 'enrollments')
    );
}
```

**비용 계산** (학생 300명):
- 학생 목록 조회: 1 쿼리
- 각 학생 enrollments: 300 쿼리
- **총**: 301 쿼리 × 탭 진입 시마다

### 2.3 🟡 중복 구독

**문제**: 같은 데이터에 대해 여러 컴포넌트가 독립적으로 구독

| 데이터 | 구독 위치 | 중복 수 |
|-------|---------|--------|
| enrollments | useMathClassStudents, useClassStudents, useEnglishStats | 3개 |
| classes | useTimetableClasses, useClasses | 2개 |
| users | App.tsx:480, 개별 컴포넌트 | 2+ |

---

## 3. 일일 예상 비용 (현재)

### 3.1 읽기 연산 추정

| 카테고리 | 연산 수/일 | 단가 | 비용/일 |
|---------|----------|-----|--------|
| enrollments collectionGroup | ~6,000 | $0.06/100K | $0.0036 |
| students N+1 쿼리 | ~3,000 | $0.06/100K | $0.0018 |
| classes 구독 | ~1,000 | $0.06/100K | $0.0006 |
| events 구독 | ~500 | $0.06/100K | $0.0003 |
| 기타 | ~2,000 | $0.06/100K | $0.0012 |
| **합계** | **~12,500** | | **~$0.0075/일** |

### 3.2 월간 비용 추정

- **현재**: 12,500 × 30 = 375,000 읽기/월 ≈ **$0.23/월**
- **사용량 증가 시** (5배): 1,875,000 읽기/월 ≈ **$1.13/월**

> 참고: Firestore 무료 티어 = 50,000 읽기/일 = 1,500,000 읽기/월

---

## 4. 개선 권장사항

### 4.1 즉시 적용 가능 (비용 50% 절감)

#### A. collectionGroup → 개별 쿼리 변환 (최우선)

```typescript
// 현재 (비용 높음)
const enrollmentsQuery = query(collectionGroup(db, 'enrollments'));

// 개선 (비용 낮음) - 필요한 학생만 조회
const studentIds = classes.flatMap(c => c.studentIds || []);
const uniqueStudentIds = [...new Set(studentIds)];
// 각 학생의 enrollments만 개별 조회
```

**예상 효과**: collectionGroup 600읽기 → 필요한 학생만 ~100읽기

#### B. React Query 캐싱 강화

```typescript
// 현재
staleTime: 1000 * 60 * 5,  // 5분

// 개선 - 자주 변하지 않는 데이터
staleTime: 1000 * 60 * 30,  // 30분
gcTime: 1000 * 60 * 60,     // 1시간
```

#### C. onSnapshot → getDocs + 수동 새로고침

**적용 대상**:
- `useTimetableClasses.ts` - 수업 목록은 자주 변경되지 않음
- `ClassSettingsModal.tsx` - 모달 열릴 때만 조회

```typescript
// 현재 (실시간 구독)
const unsubscribe = onSnapshot(collection(db, 'classes'), ...);

// 개선 (일회성 조회 + 캐싱)
const { data } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getDocs(collection(db, 'classes')),
    staleTime: 1000 * 60 * 10,
});
```

### 4.2 중기 개선 (비용 80% 절감)

#### A. 데이터 구조 최적화

```
현재 구조:
students/{studentId}/enrollments/{enrollmentId}
  └── className, subject, ...

개선 구조:
students/{studentId}
  └── enrollmentSummary: {
        math: "초등M_초4",
        english: "DP1"
      }

classes/{classId}
  └── studentIds: ["student1", "student2"]
  └── studentCount: 15
```

**장점**:
- N+1 쿼리 완전 제거
- 단일 문서로 학생+등록 정보 조회

#### B. 서버 사이드 집계 (Cloud Functions)

```typescript
// enrollment 변경 시 자동으로 class.studentCount 업데이트
exports.updateClassCount = onDocumentWritten(
    'students/{studentId}/enrollments/{enrollmentId}',
    async (change) => {
        // 해당 class의 studentCount 업데이트
    }
);
```

### 4.3 장기 개선 (비용 95% 절감)

#### A. 오프라인 캐싱

```typescript
// Firebase 오프라인 지속성 활성화
enableIndexedDbPersistence(db).catch((err) => {
    console.log('Offline persistence not available');
});
```

#### B. 증분 동기화

- 마지막 동기화 이후 변경된 문서만 조회
- `updatedAt` 필드 기반 필터링

---

## 5. 구현 우선순위

| 순위 | 작업 | 예상 효과 | 난이도 | 소요 시간 |
|-----|-----|---------|-------|---------|
| 1 | collectionGroup 제거 | 50% 절감 | 중 | 2-3일 |
| 2 | React Query 캐싱 강화 | 20% 절감 | 낮 | 1일 |
| 3 | onSnapshot → getDocs | 15% 절감 | 낮 | 1일 |
| 4 | 데이터 구조 최적화 | 80% 절감 | 높 | 1-2주 |
| 5 | 서버 사이드 집계 | 추가 10% | 높 | 1주 |

---

## 6. 결론

### 현재 상태
- **양호**: 대부분의 hooks가 이미 `getDocs` + React Query 사용
- **문제점**: collectionGroup 쿼리 3곳, N+1 패턴 1곳

### 즉시 조치 권장
1. `useMathClassStudents.ts` - collectionGroup 제거
2. `useClassStudents.ts` - collectionGroup 제거
3. `useEnglishStats.ts` - collectionGroup 제거
4. `useStudents.ts` - N+1 패턴 개선

### 예상 개선 효과
- **현재**: ~12,500 읽기/일
- **Phase 1 후**: ~5,000 읽기/일 (60% 절감)
- **Phase 2 후**: ~1,000 읽기/일 (92% 절감)

---

**작성자**: Claude Code (AI Assistant)
