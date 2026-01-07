# Firebase 비용 절감 분석 보고서

## 분석 대상: 출석부(Attendance) & 시간표(Timetable)

---

## ✅ 최적화 완료 현황

| 구분 | 최적화 내용 | 상태 | 예상 절감 |
|------|------------|------|----------|
| ClassCard | 개별 onSnapshot → 중앙화 조회 | ✅ 완료 | **50%+** |
| Attendance | N+1 getDoc → 배치 getDocs | ✅ 완료 | **20%+** |
| Attendance | 학생 목록 실시간 구독 유지 | ✅ 유지 | - |

---

## 🔴 높은 비용 요소 (Timetable)

### 1. 과다한 실시간 리스너 (onSnapshot)

**발견된 위치:**
- `EnglishTimetable.tsx` - 2개
- `EnglishClassTab.tsx` - 1개
- `ClassCard.tsx` - 1개 (카드당 1개 = 수업 수만큼 증가!)
- `ScenarioManagementModal.tsx` - 1개
- `StudentModal.tsx` - 1개
- `MathStudentModal.tsx` - 1개
- `useTimetableClasses.ts` - 1개
- `useEnglishStats.ts` - 3개
- `useEnglishSettings.ts` - 2개
- 기타 다수...

**문제점:**
```
수업 20개 × ClassCard onSnapshot = 20개 실시간 리스너
→ 매 변경 시 20개 read 발생
→ 사용자 10명 동시 접속 시 200개 리스너
```

**권장 해결책:**
1. `ClassCard.tsx`의 개별 onSnapshot → 부모에서 일괄 조회 후 props 전달
2. useEnglishSettings.ts → React Query로 전환 (자주 변경 안됨)
3. 설정 문서들 → 앱 시작 시 1회 로드 후 캐싱

---

### 2. N+1 쿼리 문제

**위치:** `useAttendance.ts` (라인 96-108)

**현재 코드:**
```javascript
// 학생 N명 → getDoc N번 호출
const recordPromises = data.map(async (student) => {
    const docId = `${student.id}_${options.yearMonth}`;
    await getDoc(doc(db, RECORDS_COLLECTION, docId));
});
```

**문제점:**
- 학생 100명 → 100번 개별 getDoc 호출
- Firestore는 개별 호출 당 비용 청구

**권장 해결책:**
```javascript
// 단일 컬렉션 쿼리로 변경
const q = query(
    collection(db, RECORDS_COLLECTION),
    where('yearMonth', '==', yearMonth)
);
const snapshot = await getDocs(q); // 1회 호출
```

---

## 🟡 중간 비용 요소 (Attendance)

### 이슈: 전체 학생 실시간 구독

**위치:** `useAttendance.ts` (라인 45)

**현재:**
```javascript
const unsubscribe = onSnapshot(
    query(collection(db, STUDENTS_COLLECTION), orderBy('name')),
    ...
);
```

**특징:**
- 전체 학생 목록을 실시간으로 구독
- 학생 1명 변경 → 전체 재조회

**권장 해결책:**
- 실시간 필요 없음 → React Query로 전환
- `staleTime: 60000` (1분) 설정으로 캐싱

---

## 🟢 양호한 부분

### useFirebaseQueries.ts
- ✅ React Query 사용
- ✅ staleTime 30분~1시간 설정
- ✅ gcTime 설정으로 메모리 관리

---

## 🎯 권장 최적화 순서

| 순위 | 작업 | 예상 절감 효과 |
|------|------|--------------|
| 1 | ClassCard.tsx onSnapshot 제거 | **50%+** |
| 2 | N+1 쿼리 → 배치 쿼리 전환 | **20%+** |
| 3 | useAttendanceStudents → React Query | **10%+** |
| 4 | 설정 데이터 캐싱 강화 | **5%+** |

---

## 💡 구현 제안

### 1단계: ClassCard 최적화 (가장 높은 ROI)

```diff
- // ClassCard.tsx 내부
- useEffect(() => {
-     const unsub = onSnapshot(q, ...);
-     return () => unsub();
- }, []);

+ // EnglishTimetable.tsx (부모)
+ const { data: schedules } = useQuery({
+     queryKey: ['schedules', teacherId],
+     queryFn: () => getDocs(query(...)),
+     staleTime: 60000
+ });
+ 
+ // ClassCard에 props로 전달
+ <ClassCard schedule={schedules.find(s => s.classId === id)} />
```

### 2단계: 출석 기록 배치 조회

```diff
- // 개별 조회 (N번)
- data.map(student => getDoc(doc(db, RECORDS, `${student.id}_${yearMonth}`)));

+ // 배치 조회 (1번)
+ const q = query(collection(db, RECORDS), where('yearMonth', '==', yearMonth));
+ const snapshot = await getDocs(q);
```
