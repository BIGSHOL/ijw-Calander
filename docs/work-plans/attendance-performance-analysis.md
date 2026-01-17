# 출석부 탭 성능 분석 보고서

**작성일**: 2026-01-18

## 현재 상태

출석부 탭 진입 시 로딩이 느린 문제가 발생합니다.

---

## 분석 결과: 성능 병목 지점

### 1. N+1 쿼리 문제 - enrollments 서브컬렉션 조회

**위치**: [useAttendance.ts](file:///f:/ijw-calander/hooks/useAttendance.ts#L18-L57) (`fetchEnrollmentsForAttendanceStudents`)

```typescript
// 현재: 학생 50명씩 청킹하지만, 각 학생마다 개별 쿼리 실행
for (const chunk of chunks) {
  const promises = chunk.map(async (student) => {
    const enrollmentsRef = collection(db, STUDENTS_COLLECTION, student.id, 'enrollments');
    const enrollmentsSnap = await getDocs(enrollmentsRef); // ❌ 학생당 1개 쿼리
  });
  await Promise.all(promises);
}
```

**문제**: 학생 100명 → 100개의 Firestore 쿼리 (병렬이지만 네트워크 왕복 증가)

---

### 2. 출석 기록 개별 조회

**위치**: [useAttendance.ts L239-L281](file:///f:/ijw-calander/hooks/useAttendance.ts#L239-L281)

```typescript
// 현재: 학생별로 개별 getDoc 호출
const chunkPromises = chunk.map(async (docId) => {
  const docSnap = await getDoc(doc(db, RECORDS_COLLECTION, docId)); // ❌ 학생당 1개 쿼리
});
```

**문제**: 학생 100명 → 추가 100개의 Firestore 쿼리

---

### 3. 시험/성적 데이터 추가 로드

**위치**: [AttendanceManager.tsx L164-L174](file:///f:/ijw-calander/components/Attendance/AttendanceManager.tsx#L164-L174)

```typescript
const { examsByDate, exams = [] } = useExamsByDateMap(startDate, endDate, selectedSubject);
const { data: scoresByStudent } = useScoresByExams(studentIds, examIds);
```

**영향**: 시험 통합 기능으로 인해 추가 쿼리 발생

---

## 총 쿼리 수 예상 (학생 100명 기준)

| 단계 | 쿼리 수 | 설명 |
|------|---------|------|
| 학생 목록 | 1 | `getDocs(students)` |
| enrollments | ~100 | 학생별 서브컬렉션 |
| 출석 기록 | ~100 | 학생별 월간 기록 |
| 시험 데이터 | 2-5 | 월간 시험 + 점수 |
| 설정/정산 | 2-3 | config, settlement |
| **총합** | **~210** | 매 로드마다 |

---

## 개선 방안

### 단기 (빠른 개선)

#### 1. 로딩 상태 개선 (UX)
- 스켈레톤 UI 적용으로 체감 속도 향상
- 데이터 로드 중 기존 캐시 데이터 표시

#### 2. 쿼리 캐싱 강화
현재 `staleTime: 5분`이지만, 탭 전환 시 매번 새로 로드됩니다.
```typescript
// 개선: queryClient의 데이터 유지 확인
refetchOnMount: false, // 마운트 시 리페치 방지 (캐시 있으면)
```

### 중기 (구조 개선)

#### 3. enrollments 데이터 비정규화
학생 문서에 `enrollmentsSummary` 필드 추가하여 서브컬렉션 조회 제거

```typescript
// students/{id} 문서에 포함
{
  name: "홍길동",
  enrollmentsSummary: [
    { teacherId: "teacher1", className: "수학A", subject: "math", days: ["월", "금"] }
  ]
}
```

**효과**: 100개 쿼리 → 0개 (학생 목록 조회 시 함께 로드)

#### 4. 출석 기록 일괄 조회
`where('__name__', 'in', docIds)` 쿼리로 일괄 조회 (30개 제한 있음)

### 장기 (아키텍처 변경)

#### 5. Cloud Functions 활용
서버사이드에서 데이터 집계 후 단일 응답 반환

---

## 권장 우선순위

1. **즉시**: 쿼리 캐싱 설정 점검 (`refetchOnMount: false`)
2. **1주 내**: enrollments 비정규화 구현
3. **2주 내**: 출석 기록 일괄 조회 최적화

---

## 결론

출석부 탭의 느린 로딩은 주로 **N+1 쿼리 문제** (enrollments, 출석 기록)에서 발생합니다.
학생 수가 많을수록 문제가 심해지며, 데이터 비정규화를 통해 쿼리 수를 대폭 줄일 수 있습니다.
