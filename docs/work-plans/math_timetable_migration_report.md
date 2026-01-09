# 수학 시간표 마이그레이션 디버깅 및 해결 보고서

## 1. 개요
*   **작업 일시**: 2026-01-09
*   **작업 목표**: "새 데이터 구조" 전환 시 수학 시간표가 보이지 않는 문제 해결 및 데이터 마이그레이션 완료.
*   **결과**: 마이그레이션 성공 (725건), 시간표 정상 표시 확인.

## 2. 문제 원인 분석
1.  **데이터 구조 불일치**: 기존 `수업목록` 컬렉션의 데이터가 새 구조인 `enrollments`로 이동할 때, `schedule` 필드가 제대로 복사되지 않음.
2.  **권한 문제 (Node.js)**: 외부 스크립트(`migrateToEnrollments.ts`)에서 Firestore에 접근하려 했으나, 인증 권한(`auth/admin-restricted-operation`) 문제로 인해 데이터를 읽거나 쓸 수 없었음.
3.  **필드 명칭 다양성**: 일부 레거시 데이터에서 `schedule` 대신 `times`, `time`, `slots` 등의 필드를 사용하고 있었으나, 마이그레이션 로직이 이를 처리하지 못함.

## 3. 해결 과정

### 3.1. 전략 변경 (Node.js Script → Browser UI)
권한 문제를 근본적으로 해결하기 위해, 이미 인증된 상태로 실행되는 **웹 애플리케이션의 UI(설정 페이지)**를 활용하여 마이그레이션을 수행하기로 결정했습니다.

### 3.2. MigrationTab.tsx 코드 개선
기존에 존재하던 "데이터 마이그레이션" 탭의 로직을 다음과 같이 보강했습니다:
*   **다중 필드 검사**: `schedule` 필드가 비어있을 경우, `times`, `time`, `slots` 필드를 순차적으로 확인하여 데이터를 찾아내도록 수정했습니다.
*   **디버그 로그 강화**: 데이터 처리 과정을 실시간으로 확인할 수 있도록 로그 기능을 강화했습니다.

```typescript
// 개선된 로직 예시
let finalSchedule = classData.schedule || [];
if (!finalSchedule || finalSchedule.length === 0) {
    if (classData.times) finalSchedule = classData.times;
    else if (classData.time) finalSchedule = classData.time;
    // ...
}
```

### 3.3. 실행 및 검증
*   브라우저의 **설정 > 데이터 마이그레이션** 탭에서 "마이그레이션 시작"을 실행했습니다.
*   **결과**: 725개의 수업 데이터가 `students/{id}/enrollments` 경로로 성공적으로 생성되었습니다.
*   **검증**: "새 데이터 구조 사용" 토글을 켠 상태에서 수학 시간표 페이지를 확인한 결과, 모든 수업이 정상적으로 그리드에 표시되었습니다.

## 4. 결론
수학 시간표 데이터가 성공적으로 새로운 구조로 이관되었습니다. 이제 `enrollments` 컬렉션을 기반으로 한 학생 중심의 데이터 관리가 가능합니다.

### 첨부: 마이그레이션 완료 화면
![Math Timetable Verified](file:///C:/Users/user/.gemini/antigravity/brain/f33ed0f1-5b2f-44fa-8b1e-29c368f560bc/final_math_timetable_verified_1767972595473.png)
