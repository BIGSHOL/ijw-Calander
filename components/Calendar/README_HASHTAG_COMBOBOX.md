# HashtagCombobox 컴포넌트

## 개요
연간 일정에서 해시태그를 관리하기 위한 Combobox 컴포넌트입니다. 기본 제공 태그 선택, 커스텀 태그 추가, 최근 사용 태그 관리 등의 기능을 제공합니다.

## 주요 기능

### 1. 기본 태그 선택
- Firebase에서 로드한 기본 태그 목록 표시
- 드롭다운에서 클릭으로 선택
- 색상 코드와 함께 표시

### 2. 커스텀 태그 추가
- 사용자가 직접 태그 이름 입력
- 자동으로 `custom_` 접두사가 붙은 ID 생성
- 입력 검증:
  - 최대 15자 제한
  - 한글, 영문, 숫자만 허용
  - 중복 방지

### 3. 최근 사용 태그
- localStorage에 최근 사용한 태그 저장 (`ijw_recent_hashtags`)
- 최대 20개 저장
- 사용 횟수 카운트
- 최근 사용 순으로 정렬

### 4. 키보드 네비게이션
- **Enter**: 선택된 항목 추가 또는 커스텀 태그 생성
- **ArrowDown/ArrowUp**: 옵션 간 이동
- **Escape**: 드롭다운 닫기
- **Backspace**: 입력이 비어있을 때 마지막 태그 제거

### 5. 태그 칩
- 선택된 태그를 칩 형태로 표시
- 각 태그의 색상 적용
- × 버튼으로 개별 제거

## Props

```typescript
interface HashtagComboboxProps {
  availableTags: EventTag[];      // 기본 제공 태그 목록
  selectedTags: string[];          // 선택된 태그 ID 배열
  onTagsChange: (tags: string[]) => void;  // 태그 변경 핸들러
  disabled?: boolean;              // 비활성화 상태
  maxTags?: number;                // 최대 선택 가능 태그 수 (기본: 10)
}
```

## 사용 예시

```tsx
import HashtagCombobox from './Calendar/HashtagCombobox';

function EventModal() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<EventTag[]>(DEFAULT_EVENT_TAGS);

  return (
    <HashtagCombobox
      availableTags={availableTags}
      selectedTags={selectedTags}
      onTagsChange={setSelectedTags}
      disabled={false}
    />
  );
}
```

## 데이터 구조

### EventTag
```typescript
interface EventTag {
  id: string;      // 태그 고유 ID
  name: string;    // 표시될 태그 이름
  color?: string;  // 색상 (hex)
}
```

### RecentTag (localStorage)
```typescript
interface RecentTag {
  id: string;      // 태그 ID
  name: string;    // 태그 이름
  count: number;   // 사용 횟수
  lastUsed: number; // 마지막 사용 시간 (timestamp)
}
```

## 커스텀 태그 ID 규칙
- 형식: `custom_{normalized_name}`
- 예시:
  - "학부모 상담" → `custom_학부모_상담`
  - "내부회의" → `custom_내부회의`

## 드롭다운 구조

```
┌──────────────────────┐
│ 기본 태그            │  ← 기본 제공 태그 섹션
│ ○ # 회의            │
│ ○ # 세미나          │
│ ──────────────────── │
│ 최근 사용           │  ← 최근 사용 태그 섹션
│ ○ # 학부모상담 (5)  │  (사용 횟수 표시)
│ ○ # 내부회의 (3)    │
│ ──────────────────── │
│ 직접 추가           │  ← 커스텀 태그 생성
│ + "상담" 태그 추가  │
└──────────────────────┘
```

## 스타일링
- Tailwind CSS 사용
- 브랜드 색상: `#fdb813` (포커스 링)
- 반응형 디자인 적용
- 드롭다운 최대 높이: 320px (max-h-80)

## 로컬 스토리지
- **키**: `ijw_recent_hashtags`
- **저장 시점**: 태그 선택/추가 시
- **정리**: 20개 초과 시 오래된 항목 자동 삭제

## 주의사항
1. **중복 방지**: 동일한 태그 ID는 한 번만 선택 가능
2. **검증**: 특수문자, 이모지 등은 입력 불가
3. **성능**: localStorage 저장 실패 시 콘솔 에러만 출력 (기능은 정상 동작)
4. **접근성**: 키보드 네비게이션 전체 지원

## 통합 위치
- `components/Calendar/EventModal.tsx` (883-900번 라인)
- 기존 체크박스 드롭다운 방식을 대체

## 향후 개선 사항
- [ ] Firestore 통합 (사용자별 커스텀 태그 저장)
- [ ] 태그 자동 완성 강화 (fuzzy search)
- [ ] 태그 그룹화/카테고리화
- [ ] 태그 색상 커스터마이징
- [ ] 관리자용 태그 관리 UI (Settings)

## 관련 파일
- `components/Calendar/HashtagCombobox.tsx` - 메인 컴포넌트
- `components/Calendar/EventModal.tsx` - 통합 위치
- `components/Settings/HashtagsTab.tsx` - 태그 관리 UI
- `types.ts` - EventTag 인터페이스 정의
