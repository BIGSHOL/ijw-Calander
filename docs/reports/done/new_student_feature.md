# 신입생 강조 표시 기능 구현 계획

## 목표
학생을 **'신입생'**으로 지정하면 등록일 기준 **2개월간** 시각적으로 강조 표시합니다.
- **1개월 차**: 붉은 배경 + 흰색 글씨 (강조)
- **2개월 차**: 연한 붉은 배경 (알림)
- **3개월 차 이상**: 평소와 동일

## 데이터 모델 변경

### `types.ts`
`TimetableStudent` 인터페이스에 `enrollmentDate` 필드를 추가합니다.
```typescript
export interface TimetableStudent {
    id: string;
    name: string;
    englishName?: string;
    school?: string;
    grade?: string;
    underline?: boolean;
    enrollmentDate?: string; // ISO Date String (YYYY-MM-DD)
}
```

## 기능 로직

### 1. 신입생 상태 설정 (`StudentModal`)
- **UI**: 학생 목록의 기존 '밑줄' 버튼 옆에 **'신입' (N)** 아이콘 버튼 추가.
- **동작**:
  - 버튼 활성화 시: `enrollmentDate`를 **오늘 날짜**로 설정 (로컬 상태 업데이트 -> 저장 시 반영).
  - 버튼 비활성화 시: `enrollmentDate`를 `undefined` 또는 `null`로 제거.
  - *옵션*: 필요시 날짜를 직접 수정할 수 있는 기능은 추후 고려 (일단 토글 시 '오늘' 기준으로 구현).

### 2. 시각적 스타일링 (`EnglishClassTab`, `StudentModal`)
학생 표시 컴포넌트에서 `enrollmentDate`와 `today`를 비교하여 스타일 클래스를 적용합니다.

```typescript
// 스타일 결정 로직 예시
const getNewStudentStyle = (enrollmentDate?: string) => {
    if (!enrollmentDate) return {};
    
    const start = new Date(enrollmentDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
        return { backgroundColor: '#ef4444', color: 'white' }; // Red-500
    } else if (diffDays <= 60) {
        return { backgroundColor: '#fee2e2', color: 'black' }; // Red-100
    }
    return {};
};
```

## 파일 변경 계획

### `d:\ijw-calander\types.ts`
- `TimetableStudent`에 `enrollmentDate` 추가.

### `d:\ijw-calander\components\Timetable\English\StudentModal.tsx`
- **Import**: `Sparkles` or `Baby` or `UserPlus` icon for 'New Student'.
- **UI**: 학생 리스트 아이템에 신입생 토글 버튼 추가.
- **Handler**: `handleToggleNewStudent(studentId)` 구현.

### `d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx`
- **UI**: `ClassCard` 내부 학생 이름 렌더링 부분에 위 스타일링 로직 적용.
- `englishName` 등을 표시할 때 텍스트 색상에 유의 (흰색 배경일 때는 회색이지만, 붉은 배경일 때는 흰색이어야 함).

## 테스트 시나리오
1. 학생 A를 신입생으로 설정 -> 오늘 날짜 저장 -> **붉은 배경** 확인.
2. 수동으로 날짜를 40일 전으로 조작 (DB/Code 임시 수정) -> **연한 배경** 확인.
3. 61일 전으로 조작 -> **원상 복구** 확인.
