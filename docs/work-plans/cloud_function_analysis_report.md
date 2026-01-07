# Cloud Function 도입 적합성 분석 보고서

## 분석 대상: `ijw-calander/components` 폴더

---

## 📊 컴포넌트별 분석 요약

| 폴더 | Cloud Function 필요성 | 우선순위 | 설명 |
|------|-----------------|---------|------|
| Attendance | ✅ 적용 완료 | - | 시간표 연동 동기화 |
| Timetable | ✅ 적용 완료 | - | 학생/수업 동기화 트리거 |
| **settings/TeachersTab** | 🔴 **높음** | 1순위 | 강사 정보 변경 → 전체 데이터 동기화 |
| **PaymentReport** | 🔴 **높음** | 1순위 | localStorage 의존 → Firestore 마이그레이션 필요 |
| Consultation | 🟡 중간 | 2순위 | 통계 자동 집계/알림 |
| Calendar | 🟢 낮음 | 3순위 | 이벤트 알림(선택) |
| Gantt | 🟢 낮음 | - | 독립적 일정 관리 |
| Auth | ⚪ 불필요 | - | 로그인/회원가입만 담당 |
| Common | ⚪ 불필요 | - | 공용 UI 컴포넌트 |

---

## 🔴 1순위: 즉시 도입 권장

### 1. PaymentReport (수강료 보고서) - **긴급**

**현재 문제점:**
```
데이터 저장소: localStorage (브라우저 내부 저장)
```
- ❌ 다른 기기/브라우저에서 접근 불가
- ❌ 브라우저 캐시 삭제 시 데이터 손실
- ❌ 팀 공유 불가능

**Cloud Function 도입 시 장점:**
- ✅ Firestore 저장 → 모든 기기에서 동일 데이터 접근
- ✅ 월별 자동 정산 (Scheduled Function)
- ✅ 이전 월 데이터 자동 이관
- ✅ AI 분석 결과 서버 캐싱

**권장 작업:**
1. `tuition_history` localStorage → Firestore 마이그레이션
2. 월간 정산 데이터 자동 스냅샷 함수 추가

---

### 2. settings/TeachersTab (강사 관리)

**현재 문제점:**
- 강사 이름 변경 시 `수업목록`만 업데이트됨
- `students` 컬렉션의 `enrollments`는 별도로 업데이트 해야함 (현재 수업목록 트리거로 커버되긴 함)

**추가 Cloud Function 도입 시 장점:**
- ✅ 강사 삭제 시 관련 수업/학생 데이터 정리
- ✅ 강사 과목 변경 시 영향받는 수업 자동 조정

---

## 🟡 2순위: 권장 도입

### 3. Consultation (상담 관리)

**현재 상태:** Firestore 사용 ✅

**Cloud Function 도입 시 장점:**
- 상담 결과에 따른 자동 학생 등록 트리거
- 월간 상담 통계 자동 집계
- 상담 예정일 알림 (Scheduled Function)

---

## 🟢 3순위: 선택적 도입

### 4. Calendar (연간 일정)

**현재 상태:** Firestore 사용 ✅

**Cloud Function 도입 시 장점:**
- 중요 일정 미리 알림 (예: 개강일 D-7)
- 반복 일정 자동 생성

---

## ⚪ 도입 불필요

| 폴더 | 이유 |
|------|------|
| Auth | Firebase Auth 자체 기능으로 충분 |
| Common | UI 컴포넌트만 포함 |
| Gantt | 독립적 일정 데이터, 외부 동기화 없음 |

---

## 🎯 권장 실행 순서

1. **PaymentReport Firestore 마이그레이션**
   - localStorage → Firestore 전환
   - 월별 정산 스냅샷 Cloud Function
   
2. **TeachersTab 이벤트 트리거 강화**
   - 강사 삭제 시 연쇄 정리 로직
   
3. **Consultation 자동화** (선택)
   - 등록 전환 자동 처리
   - 월간 통계 리포트
