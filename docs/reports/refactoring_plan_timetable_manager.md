# 🏗️ 리팩토링 계획서: TimetableManager.tsx 분리 및 최적화

## 1. 개요
*   **목표**: 1600줄 이상의 대형 파일인 `TimetableManager.tsx`를 논리적 단위로 분리하여 유지보수성, 가독성, 재사용성을 향상시킴.
*   **핵심 원칙**:
    *   🔴 **기능 손상 절대 금지**: 기존 로직과 동작을 100% 보존.
    *   🔴 **성능 저하 방지**: 불필요한 리렌더링이 발생하지 않도록 메모이제이션(`useMemo`, `useCallback`) 적극 활용.
    *   **단계적 진행**: 한 번에 모든 것을 바꾸지 않고, 안전한 단위(Hook 추출 -> UI 컴포넌트 분리)로 나누어 진행.

## 2. 현재 상태 분석 (`TimetableManager.tsx`)
*   **크기**: 1661 Lines (약 101KB)
*   **주요 역할**:
    *   전역 및 지역 상태 관리 (필터, 모달 상태, 데이터 상태)
    *   Firebase 데이터 구독 및 CRUD 연산 (`classes`, `teachers`, `settings`)
    *   비즈니스 로직 (교시 계산, 연속 교시 확인, 충돌 체크, 드래그 앤 드롭)
    *   UI 렌더링 (헤더, 그리드 테이블, 각종 모달)
*   **문제점**: 관련 없는 관심사가 혼재되어 있어 코드 수정 시 영향 범위 파악이 어렵고 가독성이 낮음.

## 3. 리팩토링 전략 (Phase-by-Phase)

### Phase 1: 비즈니스 로직 및 상태 관리 분리 (Custom Hooks pattern)
가장 안전하고 효과적인 첫 단계입니다. UI 렌더링 로직은 그대로 두고, 데이터 처리 로직만 별도 파일로 추출합니다.

| 추출 대상 | 파일명 (예정) | 역할 |
| :--- | :--- | :--- |
| **데이터 로딩** | `hooks/timetable/useTimetableClasses.ts` | Firebase 구독, 클래스 목록 로딩 |
| **설정 관리** | `hooks/timetable/useMathConfig.ts` | 강사 순서, 요일 순서 설정 로딩 및 저장 |
| **수업 CRUD** | `hooks/timetable/useClassOperations.ts` | 수업 추가, 수정, 삭제, 학생 추가/삭제/퇴원 로직 |
| **DnD 로직** | `hooks/timetable/useStudentDragDrop.ts` | 학생 이동 드래그 앤 드롭 상태 및 핸들러 |

### Phase 2: UI 컴포넌트 분리
Hook 분리가 안정화된 후, 거대해진 `render` 부분을 작은 컴포넌트로 쪼갭니다.

| 분리 대상 | 파일명 (예정) | 위치 |
| :--- | :--- | :--- |
| **상단 헤더** | `TimetableHeader.tsx` | 검색, 주간 이동, 필터, 설정 버튼 등 |
| **메인 그리드** | `TimetableGrid/index.tsx` | 테이블 구조 (thead, tbody) |
| **그리드 셀** | `TimetableGrid/ClassCell.tsx` | 각 시간표 셀 내 수업 아이템 렌더링 |
| **수업 추가 모달** | `Modals/AddClassModal.tsx` | 수업 생성 폼 |
| **수업 상세 모달** | `Modals/ClassDetailModal.tsx` | 수업 수정, 학생 관리, 삭제 |
| **보기 설정 모달** | `Modals/ViewSettingsModal.tsx` | 보기 옵션 (크기, 컬럼 등) |

### Phase 3: 최종 조립 및 검증
*   `TimetableManager.tsx`는 위 Hook들과 컴포넌트들을 조합(Composition)하는 역할만 수행하게 되어 코드가 **200줄 이내**로 대폭 감소할 것입니다.

## 4. 디렉토리 구조 제안
```
components/
  Timetable/
    Math/
      hooks/                  # 수학 시간표 전용 Hooks
        useTimetableClasses.ts
        useClassOperations.ts
        ...
      components/             # 분리된 UI 컴포넌트
        TimetableHeader.tsx
        TimetableGrid.tsx
        ClassCell.tsx
        Modals/
          AddClassModal.tsx
          ClassDetailModal.tsx
          ...
      TimetableManager.tsx    # 메인 진입점 (Cleaned)
```

## 5. 안전 장치 (Safety Measures)
1.  **TypeScript 엄격 적용**: Props 및 State 타입 정의를 `types/timetable.ts` 등으로 명확히 하여 데이터 흐름의 오류 차단.
2.  **점진적 배포**:
    *   1단계: Hook 추출 -> 빌드 및 동작 테스트 -> 커밋
    *   2단계: 작은 모달부터 컴포넌트 분리 -> 테스트 -> 커밋
    *   3단계: 메인 그리드 및 헤더 분리 -> 테스트 -> 커밋
3.  **수동 검증 체크리스트**:
    *   [ ] Firebase 실시간 업데이트 확인 (다른 창에서 변경 시 반영 여부)
    *   [ ] 학생 드래그 앤 드롭이 부드럽게 작동하는가
    *   [ ] 수업 추가/수정/삭제 시 에러 없이 즉시 반영되는가
    *   [ ] 검색 필터가 정상 작동하는가

## 6. 승인 요청
위 계획대로 진행하여 파일 크기를 줄이고 구조를 개선하려 합니다.
**Phase 1 (Hook 분리)**부터 시작해도 될까요?
