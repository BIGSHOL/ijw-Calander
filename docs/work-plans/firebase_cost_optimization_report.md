# Firebase 비용 절감 분석 보고서

## 분석 대상: 출석부(Attendance) & 시간표(Timetable)

---

## ✅ 완료된 최적화 (2026-01-07)

| 구분 | 최적화 내용 | 상태 | 절감 효과 |
|------|------------|------|----------|
| **ClassCard** | 개별 onSnapshot → `useClassStudents` 중앙화 훅 | ✅ **완료** | **~50%** |
| **Attendance** | N+1 getDoc → 배치 getDocs (30개 청킹) | ✅ **완료** | **~20%** |
| **Attendance** | 학생 목록 실시간 구독 (출석 마킹 필수) | ✅ 유지 | - |

**총 적용 절감 효과: ~70%**

---

## � 남은 권장 최적화 (향후 작업)

### 우선순위 1: 설정 데이터 캐싱 강화 (~5% 추가 절감)

| 파일 | 현재 상태 | 권장 조치 |
|------|----------|----------|
| `useEnglishSettings.ts` | onSnapshot 2개 | React Query 전환 (설정은 자주 변경 안됨) |
| `useEnglishStats.ts` | onSnapshot 3개 | 1분 캐싱으로 전환 |
| `LevelSettingsModal.tsx` | onSnapshot 1개 | 열릴 때만 1회 fetch |

**구현 코드:**
```typescript
// useEnglishSettings.ts 개선
export const useEnglishSettings = () => {
    return useQuery({
        queryKey: ['englishSettings'],
        queryFn: () => getDoc(doc(db, 'settings', 'english_class_integration')),
        staleTime: 1000 * 60 * 30, // 30분 캐싱
    });
};
```

---

### 우선순위 2: 모달 온디맨드 로딩 (~3% 추가 절감)

| 파일 | 현재 상태 | 권장 조치 |
|------|----------|----------|
| `ScenarioManagementModal.tsx` | 항상 구독 | 모달 열릴 때만 fetch |
| `BackupHistoryModal.tsx` | 항상 구독 | 모달 열릴 때만 fetch |
| `StudentModal.tsx` | 항상 구독 | props로 데이터 전달 |

---

### 우선순위 3: Math 시간표 최적화 (~2% 추가 절감)

| 파일 | 현재 상태 | 권장 조치 |
|------|----------|----------|
| `useTimetableClasses.ts` | onSnapshot 전체 구독 | React Query + 5분 캐싱 |
| `MathStudentModal.tsx` | 개별 문서 구독 | props 전달 방식으로 변경 |

---

## 📊 예상 총 절감 효과

| 단계 | 작업 | 절감 효과 | 상태 |
|------|------|----------|------|
| 1 | ClassCard 중앙화 | ~50% | ✅ 완료 |
| 2 | N+1 배치 쿼리 | ~20% | ✅ 완료 |
| 3 | 설정 캐싱 강화 | ~5% | ⏳ 대기 |
| 4 | 모달 온디맨드 | ~3% | ⏳ 대기 |
| 5 | Math 최적화 | ~2% | ⏳ 대기 |

**현재 적용 절감: ~70%**  
**추가 가능 절감: ~10%**  
**최대 가능 절감: ~80%**

---

## 💡 장기 권장사항

1. **Firestore 복합 인덱스 추가**
   - `students` 컬렉션에 `teacherId + status` 인덱스 생성
   - 클라이언트 필터링 → 서버 필터링 전환

2. **Firebase Functions 스케줄러 활용**
   - 월별 출석 통계 미리 계산 → Firestore에 캐싱
   - 실시간 계산 부하 감소

3. **Firestore Bundle 사용 고려**
   - 자주 변경 안되는 설정 데이터 → Bundle로 CDN 캐싱

