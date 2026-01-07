# 📦 일정 자동 아카이빙 시스템 구현 계획 (Auto-Archiving Implementation Plan)

## 1. 개요 및 목적
- **목적**: 앱 구동 시 로딩되는 데이터 양을 줄여 **성능을 최적화**하고 **Firebase 읽기 비용을 절감**함.
- **방식**: 설정된 기간(예: 4년)이 지난 일정을 메인 컬렉션(`일정`)에서 보관용 컬렉션(`archived_events`)으로 자동 이동.

## 2. 아키텍처 설계

### A. 데이터 구조
- **Active DB (`일정`)**: 최근 N년(설정값) 이내의 일정. 앱에서 상시 로딩.
- **Archive DB (`archived_events`)**: N년 지난 일정. 요청 시에만 로딩.

### B. 설정 연동 (`SystemConfig`)
- **`eventLookbackYears`**: 기존 "데이터 보존 기간" 설정을 재활용.
- **의미 변경**: 
  - (기존) 앱에서 보여주는 기간 (그 이전 데이터는 DB에 있어도 안 가져옴)
  - (변경) **Active DB에 남겨둘 기간** (그 이전 데이터는 Archive DB로 이동됨)
  - 예: "4년" 설정 시, 종료일이 4년 지난 일정은 매일 밤 Archive로 이동.

### C. Cloud Function (`archiveOldEvents`)
- **트리거**: 매일 자정 (Cron Job / PubSub)
- **로직**:
  1. `system_config`에서 `eventLookbackYears` 조회 (기본값 2년).
  2. 기준일(`cutoffDate`) 계산: `오늘 - (Years * 365)일`.
  3. 쿼리: `collection('일정').where('종료일', '<', cutoffDate)`.
  4. 배치 작업:
     - `archived_events`에 문서 복사.
     - `일정`에서 문서 삭제.
  5. 로그: 이동된 문서 개수 기록.

### D. 클라이언트 (App.tsx / Settings)
1. **메인 뷰 (`Active`)**:
   - 변동 없음. 기존 로직(`where('시작일', '>=', lookbackDate)`) 유지.
   - 아카이빙이 돌면 자연스럽게 오래된 데이터가 사라지므로, 쿼리 결과가 가벼워짐.

2. **아카이브 뷰 (`Archive`)**:
   - 연간 뷰 헤더에 **"🗄️ 지난 기록 보기"** 토글 버튼 추가.
   - 활성화 시: `archived_events` 컬렉션에서 해당 연도의 데이터를 Fetch 하여 메인 `events` 상태에 병합(또는 교체).

3. **수정 및 복구 (Restore)**:
   - 아카이브된 일정을 수정하려 할 때:
     - **Option 1 (자동 복구)**: 수정 후 저장 시 메인 `일정` 컬렉션으로 저장. (가장 자연스러움)
     - **결과**: 수정된 "과거 일정"은 다시 Active 상태가 되지만, 다음번 아카이빙 주기 때 날짜가 여전히 과거라면 다시 아카이브됨. (문제 없음, 오히려 수정한 내용을 당분간 메인에서 볼 수 있어 좋음).

## 3. 구현 단계 (Step-by-Step)

### Phase 1: Cloud Function 구현
- [ ] `functions/index.js`에 `archiveOldEvents` 함수 추가.
- [ ] `verifyArchiving.ts` 스크립트로 동작 검증 (Dry Run).

### Phase 2: 클라이언트 UI 적용
- [ ] `App.tsx`: "지난 기록 보기" 상태(State) 및 토글 UI 추가.
- [ ] `App.tsx`: 아카이브 데이터 Fetch 로직 구현 (`useArchivedEvents`).
- [ ] `CalendarBoard/YearlyView`: 토글 버튼 배치.

### Phase 3: 배포 및 활성화
- [ ] Firebase Functions 배포.
- [ ] 스케줄러 활성화.

## 4. 기대 효과
- **초기 로딩 속도**: 매년 데이터가 쌓여 느려지는 문제 영구 해결.
- **Firebase 비용**: 오래된 데이터에 대한 불필요한 Read 쿼리 방지.
- **데이터 관리**: "4년 보존" 설정의 의미가 명확해짐.
