# 영어시간표 시나리오 저장/불러오기 기능 구현 계획

## 개요
시뮬레이션 모드에서 여러 시간표 시나리오를 저장하고 비교할 수 있는 기능을 구현합니다.

## 사용자 요구사항
- **사용 모드**: 시뮬레이션 모드에서만 사용
- **적용 방식**: 항상 Draft 컬렉션에 적용 (안전한 테스트 환경)
- **권한**: 시뮬레이션 편집 권한(`timetable.english.edit`)과 동일
- **추가 기능**: 설명 필드 + 시나리오 비교 기능

## 구현 단계

### Phase 1: 핵심 기능 (우선순위: 높음)
시나리오 저장, 불러오기, 관리 기능

### Phase 2: 비교 기능 (우선순위: 중간)
두 시나리오를 비교하는 UI

---

## 데이터 구조

### ScenarioEntry 인터페이스
```typescript
interface ScenarioEntry {
  id: string;                        // 문서 ID
  name: string;                      // 시나리오 이름
  description: string;               // 상세 설명

  // 스냅샷 데이터
  data: Record<string, any>;         // english_schedules_draft
  studentData: Record<string, any>;  // 수업목록_draft

  // 메타데이터
  createdAt: string;
  createdBy: string;
  createdByUid: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByUid?: string;

  // 통계 (UI 표시용)
  stats?: {
    timetableDocCount: number;
    classCount: number;
    studentCount: number;
  };
}
```

### Firestore 컬렉션
- **컬렉션명**: `english_simulation_scenarios`
- **정렬**: `createdAt` 내림차순
- **보안 규칙**: 읽기(로그인), 생성(편집권한), 수정(생성자/Master), 삭제(Master)

---

## 주요 기능

### 1. 시나리오 저장
- 현재 Draft 상태 캡처 (`english_schedules_draft`, `수업목록_draft`)
- 사용자 입력: 이름(필수), 설명(선택)
- 통계 자동 계산
- Firestore에 저장

### 2. 시나리오 불러오기
- **안전장치**: 불러오기 전 현재 Draft 상태를 `english_backups`에 자동 백업
- 데이터 검증
- Draft 컬렉션에 적용 (기존 데이터 삭제 → 시나리오 데이터 쓰기)
- 성공 시 백업 ID와 함께 확인 메시지

### 3. 시나리오 관리
- 목록 조회 (실시간 업데이트)
- 이름/설명 인라인 편집 (생성자 또는 Master)
- 삭제 (Master만)
- 손상된 데이터 자동 감지 및 표시

### 4. 시나리오 비교 (Phase 2)
- 두 시나리오 선택
- 차이점 계산 (추가/삭제/수정된 셀)
- 나란히 비교 UI

---

## 파일 변경 목록

### 수정할 기존 파일

#### 1. `f:\ijw-calander\types.ts`
- **위치**: line 18 이후 (BackupEntry 인터페이스 다음)
- **변경**: `ScenarioEntry` 인터페이스 추가

#### 2. `f:\ijw-calander\components\Timetable\English\englishUtils.ts`
- **위치**: line 44 이후
- **변경**: 상수 추가
  ```typescript
  export const SCENARIO_COLLECTION = 'english_simulation_scenarios';
  ```

#### 3. `f:\ijw-calander\components\Timetable\English\EnglishTimetable.tsx`
- **변경 1 (line 4)**: 아이콘 import에 `Save` 추가
- **변경 2 (line 12)**: 새 모달 import 추가
  ```typescript
  import ScenarioManagementModal from './ScenarioManagementModal';
  ```
- **변경 3 (line 41 이후)**: state 추가
  ```typescript
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  ```
- **변경 4 (line 358 이후)**: "시나리오 관리" 버튼 추가 (백업 버튼 앞)
  ```typescript
  <button
      onClick={() => setIsScenarioModalOpen(true)}
      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
      title="시나리오 저장/불러오기"
  >
      <Save size={12} />
      시나리오 관리
  </button>
  ```
- **변경 5 (line 423 이후)**: 모달 컴포넌트 추가
  ```typescript
  <ScenarioManagementModal
      isOpen={isScenarioModalOpen}
      onClose={() => setIsScenarioModalOpen(false)}
      currentUser={currentUser}
      isSimulationMode={isSimulationMode}
  />
  ```

### 새로 생성할 파일

#### 1. `f:\ijw-calander\components\Timetable\English\scenarioUtils.ts`
**목적**: 시나리오 관련 유틸리티 함수

**함수 목록**:
- `validateScenarioData(scenario)`: 시나리오 데이터 검증
  - 필수 필드 확인 (id, createdAt, data, studentData)
  - 데이터 구조 검증
  - 반환: `{ isValid: boolean; error?: string }`

- `calculateScenarioStats(data, studentData)`: 통계 계산
  - 시간표 문서 수 카운트
  - 수업 수 카운트
  - 활성 학생 수 카운트 (onHold, withdrawn 제외)
  - 반환: `{ timetableDocCount, classCount, studentCount }`

- `generateScenarioId()`: 고유 ID 생성
  - 반환: `scenario_${Date.now()}`

**참고 패턴**: BackupHistoryModal.tsx의 `validateBackupData()` (lines 30-77)

#### 2. `f:\ijw-calander\components\Timetable\English\ScenarioManagementModal.tsx`
**목적**: 시나리오 관리 메인 UI

**주요 섹션**:

1. **Imports & State**
   - Firestore 함수, 아이콘, 유틸리티
   - State: scenarios, loading, activeOperation, editing, saveDialog

2. **실시간 리스너**
   - `useEffect`로 Firestore 구독
   - `createdAt` 내림차순 정렬
   - 컴포넌트 언마운트 시 구독 해제

3. **핵심 함수**

   **handleSaveScenario()**:
   ```
   1. 이름 입력 검증
   2. Draft 컬렉션에서 데이터 가져오기
   3. 비어있는지 확인
   4. 통계 계산
   5. Firestore에 저장
   6. 성공 메시지 표시
   ```

   **handleLoadScenario(scenario)**:
   ```
   1. 권한 확인
   2. 데이터 검증
   3. 확인 대화상자
   4. 현재 Draft 상태를 english_backups에 백업
   5. Batch write로 Draft 컬렉션 교체
   6. 학생 데이터도 동일하게 처리
   7. 성공 메시지 (백업 ID 포함)
   ```

   **handleUpdateScenario(scenarioId)**:
   ```
   1. 권한 확인 (생성자 또는 Master)
   2. Firestore 문서 업데이트
   3. updatedAt, updatedBy 추가
   ```

   **handleDeleteScenario(scenario)**:
   ```
   1. Master 권한 확인
   2. 확인 대화상자
   3. Firestore 문서 삭제
   ```

4. **UI 구조**
   ```
   Fixed Overlay (z-50)
   └─ Modal Container (max-w-3xl, max-h-85vh)
      ├─ Header
      │  ├─ 제목 + 아이콘
      │  └─ 닫기 버튼
      ├─ Action Bar (시뮬레이션 모드일 때만)
      │  ├─ "현재 상태 저장" 버튼
      │  └─ 시나리오 개수 표시
      ├─ Content (scrollable)
      │  ├─ Loading 상태
      │  ├─ Empty 상태
      │  └─ 시나리오 목록
      │     └─ 각 항목:
      │        ├─ 이름 (편집 가능)
      │        ├─ 설명
      │        ├─ 메타데이터 (날짜, 생성자, 통계)
      │        └─ 액션 버튼 (편집, 삭제, 불러오기)
      ├─ Footer
      │  └─ 안내 메시지
      └─ Save Dialog (모달 위 모달)
         ├─ 이름 입력 (필수)
         ├─ 설명 입력 (선택)
         └─ 저장/취소 버튼
   ```

5. **스타일링 패턴**
   - 최신 시나리오: 파란색 배경 + "최신" 배지
   - 손상된 시나리오: 빨간색 배경 + "손상됨" 배지
   - 로딩 중: 버튼 비활성화 + 애니메이션

**참고 패턴**: BackupHistoryModal.tsx 전체 구조

#### 3. `f:\ijw-calander\components\Timetable\English\ScenarioComparisonModal.tsx` (Phase 2)
**목적**: 두 시나리오 비교 UI

**주요 기능**:
- `calculateScenarioDiff()`: 두 시나리오의 차이점 계산
- 2열 레이아웃 (시나리오 A | 시나리오 B)
- 색상 코딩: 초록(추가), 빨강(삭제), 노랑(수정)
- 필터: 전체 보기 / 변경사항만 보기

---

## 권한 체계

| 작업 | 필요 권한 | 체크 위치 |
|------|----------|----------|
| 시나리오 보기 | 시뮬레이션 모드 진입 권한 | 모달 열기 시 |
| 시나리오 저장 | `canEditEnglish` | 버튼 비활성화 + 함수 진입점 |
| 시나리오 불러오기 | `canEditEnglish` | 버튼 비활성화 + 함수 진입점 |
| 시나리오 편집 | 생성자 OR Master | 버튼 가시성 + 함수 진입점 |
| 시나리오 삭제 | Master만 | 버튼 가시성 + 함수 진입점 |

---

## 에러 처리

### 검증 오류
- 빈 Draft 데이터 → 저장 차단 + 알림
- 손상된 시나리오 → 불러오기 차단 + 오류 표시

### Firestore 오류
- 네트워크 오류 → 알림 + 재시도 안내
- 권한 거부 → 명확한 권한 오류 메시지
- Batch 제한 초과 (>500) → 차단 + 문서 수 표시

### 안전장치
- 불러오기 전 자동 백업 생성
- 백업 실패 시 경고만 표시하고 계속 진행
- 모든 쓰기 작업은 Batch로 원자성 보장

---

## 테스트 시나리오

### 기본 동작
1. ✅ Draft에서 시나리오 저장
2. ✅ 시나리오 목록 실시간 업데이트 확인
3. ✅ 시나리오 불러오기
4. ✅ Pre-load 백업이 `english_backups`에 생성되는지 확인
5. ✅ Draft 데이터가 정확히 교체되는지 확인

### 권한 테스트
1. ✅ 편집 권한 없는 사용자: 저장/불러오기 버튼 비활성화
2. ✅ 일반 사용자: 타인 시나리오 편집 차단
3. ✅ Master: 모든 시나리오 편집/삭제 가능

### Edge Case
1. ✅ 빈 Draft에서 저장 시도 → 오류
2. ✅ 손상된 시나리오 불러오기 → 차단
3. ✅ 500개 이상 문서 → 오류
4. ✅ studentData 없는 구 시나리오 → 경고 후 시간표만 불러오기

---

## 배포 시 필요 작업

### Firestore Security Rules 추가
```javascript
match /english_simulation_scenarios/{scenarioId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.createdByUid;
  allow update: if request.auth != null && (
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master'
    || request.auth.uid == resource.data.createdByUid
  );
  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
}
```

### Firestore Index 생성 (권장)
- Collection: `english_simulation_scenarios`
- Field: `createdAt` (Descending)

---

## 구현 순서

### Phase 1: 핵심 기능 (1차 배포)
1. types.ts에 인터페이스 추가
2. englishUtils.ts에 상수 추가
3. scenarioUtils.ts 생성 (유틸리티 함수)
4. ScenarioManagementModal.tsx 생성 (메인 UI)
5. EnglishTimetable.tsx 수정 (버튼 + 모달 통합)
6. 테스트
7. Firestore 규칙 배포

### Phase 2: 비교 기능 (2차 배포)
1. ScenarioComparisonModal.tsx 생성
2. ScenarioManagementModal에 "비교" 버튼 추가
3. 테스트

---

## 주요 참고 파일

- **BackupHistoryModal.tsx**: 전체 구조, 함수 패턴, UI 레이아웃
- **EnglishTimetable.tsx**: 모달 통합 방식, 권한 체크
- **englishUtils.ts**: 컬렉션 상수 정의 패턴

---

## 예상 효과

✅ **안전한 테스트**: Draft만 사용하므로 실시간 데이터 영향 없음
✅ **데이터 보호**: 불러오기 전 자동 백업으로 복구 가능
✅ **협업 지원**: 여러 사용자가 시나리오 공유 및 비교
✅ **빠른 실험**: 시간표 재구성 시나리오를 쉽게 저장/비교
✅ **확장 가능**: Phase 2 비교 기능까지 확장 준비 완료
