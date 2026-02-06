# 🎯 80% 커버리지 달성 스프린트 계획

**작성일**: 2026-02-07  
**현재 커버리지**: 70%  
**목표**: 80%  
**남은 증가량**: 10%

---

## 📊 현재 상태

### 테스트 현황

| 영역 | 현재 | 목표 | 남은 증가량 |
|------|------|------|------------|
| Statements | 69.89% | 80% | +10.11% |
| Branches | 68.05% | 80% | +11.95% |
| Functions | 71.52% | 80% | +8.48% |
| Lines | 70.34% | 80% | +9.66% |

### 훅 테스트 현황 (14/52)

**✅ 이미 테스트됨 (14개)**
- useAppState
- useAttendance
- useAuth
- useClasses
- useConsultations
- useFocusTrap
- useForm
- useGlobalSearch
- useGradePromotion
- usePermissions
- useRoleSimulation
- useStudentFilters
- useStudents
- useTabPermissions

---

## 📋 80% 달성을 위한 추가 테스트 대상

### 우선순위 1: 대용량 훅 (높은 커버리지 효과)

| 훅 | 파일 크기 | 예상 효과 |
|----|----------|----------|
| `useEnglishClassUpdater.ts` | 34KB | 🔥 매우 높음 |
| `useConsultationStats.ts` | 23KB | 🔥 매우 높음 |
| `useClassMutations.ts` | 22KB | 🔥 매우 높음 |
| `useStudentFilters.ts` | 17KB | ✅ 완료 |
| `useGradeProfile.ts` | 17KB | 🔥 높음 |
| `useAppState.ts` | 15KB | ✅ 완료 |

### 우선순위 2: 중형 훅 (균형잡힌 효과)

| 훅 | 파일 크기 | 예상 효과 |
|----|----------|----------|
| `useWithdrawalStats.ts` | 14KB | 높음 |
| `useEventCrud.ts` | 14KB | 높음 |
| `useStudentConsultations.ts` | 13KB | 높음 |
| `useEnrollments.ts` | 10KB | 중간 |
| `useRoleSimulation.tsx` | 10KB | ✅ 완료 |
| `useEmbedData.ts` | 10KB | 중간 |
| `useDailyAttendance.ts` | 10KB | 중간 |

### 우선순위 3: 소형 훅 (빠른 완료)

| 훅 | 파일 크기 |
|----|----------|
| `useClassDetail.ts` | 8KB |
| `useStaff.ts` | 8KB |
| `useVisibleAttendanceStudents.ts` | 8KB |
| `useGanttTemplates.ts` | 7KB |
| `useEmbedTokens.ts` | 7KB |
| `useStudentGrades.ts` | 7KB |

---

## 🚀 스프린트 계획

### Sprint 1: 대용량 훅 (목표: 75%)

**예상 시간**: 2-3시간

1. [ ] `useEnglishClassUpdater.test.ts` 작성
2. [ ] `useConsultationStats.test.ts` 작성
3. [ ] `useClassMutations.test.ts` 작성
4. [ ] 커버리지 확인

### Sprint 2: 중형 훅 (목표: 78%)

**예상 시간**: 2-3시간

1. [ ] `useWithdrawalStats.test.ts` 작성
2. [ ] `useEventCrud.test.ts` 작성
3. [ ] `useStudentConsultations.test.ts` 작성
4. [ ] `useGradeProfile.test.ts` 작성
5. [ ] 커버리지 확인

### Sprint 3: 소형 훅 + 마무리 (목표: 80%)

**예상 시간**: 2시간

1. [ ] `useEnrollments.test.ts` 작성
2. [ ] `useStaff.test.ts` 작성
3. [ ] `useDailyAttendance.test.ts` 작성
4. [ ] 기타 소형 훅 5-6개 추가
5. [ ] 최종 커버리지 확인

---

## 🛠️ 테스트 작성 우선순위 (효율성 기준)

**가장 효과적인 6개 훅** (먼저 작성 권장):

| 순위 | 훅 | 크기 | 예상 커버리지 증가 |
|------|-----|------|------------------|
| 1 | `useEnglishClassUpdater` | 34KB | +2~3% |
| 2 | `useConsultationStats` | 23KB | +1.5~2% |
| 3 | `useClassMutations` | 22KB | +1.5~2% |
| 4 | `useGradeProfile` | 17KB | +1~1.5% |
| 5 | `useWithdrawalStats` | 14KB | +1% |
| 6 | `useEventCrud` | 14KB | +1% |

**이 6개만 완료해도 약 8~10% 증가 예상!**

---

## ✅ 검증 방법

```bash
# 스프린트별 커버리지 확인
npm run test:coverage

# 특정 파일만 테스트
npm run test -- useEnglishClassUpdater.test.ts

# HTML 리포트 확인
# coverage/index.html 열기
```

---

## 📈 예상 결과

| 단계 | 완료 후 커버리지 |
|------|-----------------|
| 현재 | 70% |
| Sprint 1 완료 | ~75% |
| Sprint 2 완료 | ~78% |
| Sprint 3 완료 | **80%+** ✅ |

---

**마지막 업데이트**: 2026-02-07
