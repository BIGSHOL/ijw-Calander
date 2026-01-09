# Unified Student DB 리팩토링 코드 점검 보고서

## 1. 개요
본 문서는 Unified Student DB 구축 전후의 코드 변화를 분석하고, 주요 변경 사항에 대한 점검 포인트 및 잠재적 리스크를 진단합니다.

## 2. 주요 변경 사항 상세 분석

### A. 핵심 데이터 구조 (`types.ts`)

| 항목 | 변경 전 | 변경 후 | 점검 포인트 |
| :--- | :--- | :--- | :--- |
| **학생 데이터 위치** | 각 `TimetableClass` 문서 내부의 `studentList` 배열 | 최상위 `students` 컬렉션 (Unified DB) | 데이터 중복 제거 확인 |
| **수업 연결 방식** | 객체 임베딩 (Embedded Object) | ID 참조 (Reference by ID) | `studentIds` 필드 생성 여부 |
| **Interfaces** | `UnifiedStudent` 없음 | `UnifiedStudent` 인터페이스 신설 | 속성(영어이름, 학교 등) 누락 여부 |

**변경 코드 예시:**
```typescript
// Before
interface TimetableClass {
  studentList: TimetableStudent[]; // 모든 정보를 들고 있음
}

// After
interface TimetableClass {
  studentList?: TimetableStudent[]; // @deprecated
  studentIds?: string[];            // ID만 들고 있음 -> students 컬렉션에서 조회
}
```

### B. 데이터 훅 및 로직 (`Hooks`)

#### 1. `hooks/useAttendance.ts` (출석부)
- **변경 전**: `attendance_students`라는 별도 컬렉션을 사용했습니다. 시간표와 데이터가 분리되어 있었습니다.
- **변경 후**: `students` (Unified DB) 컬렉션을 사용하도록 변경되었습니다.
- **점검**: 기존 출석 데이터(`attendance_records`)가 학생 ID를 키로 사용하므로, Unified DB의 학생 ID와 일치해야 기존 기록이 보입니다. (신규 구축 시 문제없음)

#### 2. `hooks/useStudents.ts` (신규)
- **기능**: 전체 학생 데이터를 중앙에서 로드하고 캐싱합니다.
- **역할**: 기존에는 각 컴포넌트가 개별적으로 학생 데이터를 들고 있었으나, 이제는 이 훅이 "Source of Truth" 역할을 합니다.

#### 3. Drag & Drop Hooks (`useStudentDragDrop`, `useEnglishChanges`)
- **변경 전**: 드래그 시 학생 객체 전체(`{name: "Kim", grade: "5"...}`)를 `studentList` 배열에서 빼고 넣었습니다.
- **변경 후**: 학생 ID(`"student_123"`)만 이동시킵니다. 학생의 상세 정보는 건드리지 않습니다.
- **이점**: 이름이나 학년이 바뀌어도 드래그 로직을 수정할 필요가 없습니다.

### C. 컴포넌트 (`Components`)

#### 1. `TimetableManager.tsx`
- **역할 변화**: 단순히 시간표를 보여주는 것에서, 전체 학생 데이터를 로드(`useStudents`)하여 하위 컴포넌트에 공급(`studentMap`)하는 "데이터 허브" 역할이 추가되었습니다.

#### 2. `ClassCard.tsx` (Math/English)
- **렌더링 방식**:
  - **Before**: `props.classInfo.studentList.map(student => ...)`
  - **After**: `props.classInfo.studentIds.map(id => props.studentMap[id]).filter(Boolean).map(student => ...)`
- **리스크**: `studentMap`에 해당 ID의 학생이 아직 로드되지 않았거나 삭제된 경우, 화면에 빈 칸으로 나올 수 있습니다. (Defense Code 추가됨)

### D. 마이그레이션 도구 (`Scripts`)

- **`migrateStudents.ts`**: 기존 시간표에서 유니크한 학생을 추출하여 DB를 구축했습니다.
- **`linkStudentsToClasses.ts`**: 구축된 DB의 ID를 다시 시간표 수업 문서에 심어주었습니다.

## 3. 코드 점검 체크리스트 (Self-Check)

### ✅ 안정성 점검
- [x] **Null Safety**: `studentMap[id]`가 `undefined`일 때 앱이 죽지 않는가? -> `.filter(Boolean)` 처리 확인.
- [x] **Data Sync**: 시간표에서 학생 이름을 바꾸면 출석부에서도 바뀌는가? -> Unified DB 사용으로 자동 해결.
- [x] **Performance**: 학생 수가 많아질 경우 `useStudents`가 모든 학생을 불러오는 것이 무겁지 않은가? -> 현재 규모(수백 명 수준)에서는 문제없으나, 향후 수천 명 단위 시 페이지네이션 고려 필요.

### ⚠️ 주의 사항 (Migration Risk)
- **과거 데이터**: 기존 `attendance_students`에 쌓인 출석 기록은 ID가 매칭되지 않으면 보이지 않을 수 있습니다. 
- **배포 시점**: 이 코드가 배포되면 기존 클라이언트(앱)와 DB 스키마가 달라질 수 있으므로, 배포 시점에 마이그레이션 스크립트를 반드시 먼저 수행해야 합니다.

## 4. 종합 의견
구조적으로 **"Single Source of Truth"** 원칙을 잘 따르도록 리팩토링되었습니다. 이전에는 학생 이름 하나를 고치려면 수학 시간표, 영어 시간표, 출석부를 다 찾아다니며 고쳐야 했지만, 이제는 한 곳(`students` 컬렉션)만 고치면 됩니다. 유지보수성과 확장성이 크게 향상되었습니다.
