# 해시태그 & 참가자 관리 사이드 패널 구현 완료

## 구현 날짜
2026-01-09

## 구현 내용

### 1. 파일 생성
- `components/Calendar/ParticipantsPanel.tsx` - 참가자 관리 사이드 패널 컴포넌트 (신규)
- `components/Settings/HashtagsTab.tsx` - 해시태그 관리 설정 탭 (이미 존재)

### 2. 수정된 파일
- `components/Calendar/EventModal.tsx` - 해시태그 기능 및 사이드 패널 통합
- `components/settings/SettingsModal.tsx` - 해시태그 탭 추가 (이미 완료)

## 주요 기능

### 해시태그 시스템
1. **Firebase 기반 동적 설정**
   - `settings/hashtag_config` 문서에서 태그 목록 및 세미나 태그 설정 로드
   - 실시간 onSnapshot으로 설정 변경사항 즉시 반영

2. **해시태그 UI (EventModal)**
   - 상세 내용 아래에 해시태그 선택 섹션 추가
   - 각 태그별 색상 및 이름 표시
   - 선택된 태그는 강조 표시 (shadow, 진한 테두리)
   - 세미나 태그 선택 시 Users 아이콘 표시

3. **자동 힌트**
   - 세미나 태그 선택 시 "참가자 관리 패널이 우측에 표시됩니다" 안내 메시지

### 참가자 관리 사이드 패널

1. **디자인**
   - 우측에서 슬라이드 인 애니메이션 (translate-x)
   - 고정 너비 384px (w-96)
   - 전체 높이 (h-full)
   - z-index 9999로 최상단 표시
   - 배경 딤 처리 (backdrop with bg-black/20)

2. **레이아웃**
   - **헤더**: 제목 "참가자 관리" + 닫기 버튼
   - **일정 정보**: 현재 일정 제목 표시
   - **참가자 추가**: 이름 입력 폼
   - **참가자 목록**: 스크롤 가능한 리스트
   - **출석 현황 통계**: 참석/대기/불참 집계

3. **참가자 카드**
   - 이름 첫 글자 아바타 (그라데이션 배경)
   - 출석 상태 버튼 (참석/대기/불참)
   - 삭제 버튼
   - 상태별 색상 코드:
     - 참석: green-100/green-700
     - 대기: yellow-100/yellow-700
     - 불참: red-100/red-700

4. **자동 열림 로직**
   - `selectedTags`와 `seminarTags` 비교
   - 세미나 태그 선택 시 `isPanelOpen` 자동 true
   - useEffect로 실시간 감지

## 기술 세부사항

### EventModal.tsx 변경사항

1. **Import 추가**
```typescript
import { EventTag, DEFAULT_EVENT_TAGS } from '../../types';
import { Hash } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import ParticipantsPanel from './ParticipantsPanel';
```

2. **State 추가**
```typescript
const [selectedTags, setSelectedTags] = useState<string[]>([]);
const [availableTags, setAvailableTags] = useState<EventTag[]>(DEFAULT_EVENT_TAGS);
const [seminarTags, setSeminarTags] = useState<string[]>(['seminar', 'workshop', 'meeting']);
const [isPanelOpen, setIsPanelOpen] = useState(false);
```

3. **Firebase 리스너**
```typescript
useEffect(() => {
  const docRef = doc(db, 'settings', 'hashtag_config');
  const unsubscribe = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      setAvailableTags(data.tags || DEFAULT_EVENT_TAGS);
      setSeminarTags(data.seminarTags || ['seminar', 'workshop', 'meeting']);
    }
  });
  return () => unsubscribe();
}, []);
```

4. **패널 자동 열림**
```typescript
useEffect(() => {
  const showPanel = selectedTags.some(tagId => seminarTags.includes(tagId));
  setIsPanelOpen(showPanel);
}, [selectedTags, seminarTags]);
```

5. **저장 시 태그 포함**
```typescript
const payload: CalendarEvent = {
  // ... 기존 필드들
  tags: selectedTags.length > 0 ? selectedTags : undefined,
};
```

### ParticipantsPanel.tsx 특징

- **Props 인터페이스**: 유연한 확장 가능
- **임시 참가자 데이터 구조**:
  ```typescript
  interface Participant {
    id: string;
    name: string;
    status: 'attending' | 'pending' | 'absent';
  }
  ```
- **TODO 표시**: 실제 Firebase 연동은 추후 구현 예정

## 데이터 구조

### CalendarEvent 타입 (기존)
```typescript
export interface CalendarEvent {
  // ... 기존 필드들
  tags?: string[];  // 해시태그 ID 배열
  attendance?: Record<string, 'pending' | 'joined' | 'declined'>;
}
```

### HashtagConfig (Firebase)
```typescript
interface HashtagConfig {
  tags: EventTag[];
  seminarTags: string[]; // 참가자 관리 UI를 표시할 태그 ID 목록
  updatedAt?: string;
}
```

## 사용자 경험 (UX)

1. **일정 생성/수정 모달**
   - 상세 내용 입력 후 해시태그 선택 가능
   - 세미나 관련 태그 선택 시 자동으로 우측 패널 표시
   - 기존 모달 레이아웃은 변경 없음 (스크롤 문제 해결)

2. **참가자 관리**
   - 별도 패널에서 독립적으로 스크롤 가능
   - 참가자 추가/삭제/상태 변경 직관적
   - 실시간 통계 표시로 한눈에 현황 파악

3. **관리자 설정**
   - 시스템 설정 > 연간 일정 > # 해시태그 탭
   - 태그 CRUD 관리
   - "참가자 관리" 토글로 세미나 태그 지정

## 향후 작업 (TODO)

1. **참가자 데이터 Firebase 연동**
   - CalendarEvent에 participants 필드 구조 정의
   - Firebase 저장/로드 로직 구현
   - 실시간 동기화

2. **권한 관리**
   - 참가자 추가/삭제 권한 체크
   - 일정 작성자 vs 일반 사용자 구분

3. **알림 기능**
   - 참가자 상태 변경 시 알림
   - 등록 마감 알림

4. **출석부 통합**
   - 4-quadrant 출석부와 연동
   - Q2 (출결 관리) 영역 활성화

## 테스트 시나리오

1. **해시태그 선택**
   - [ ] 일정 생성 시 해시태그 선택 가능
   - [ ] 여러 해시태그 동시 선택
   - [ ] 세미나 태그 선택 시 패널 자동 열림
   - [ ] 태그 해제 시 패널 자동 닫힘

2. **사이드 패널**
   - [ ] 우측에서 슬라이드 인 애니메이션
   - [ ] 배경 클릭 시 패널 닫힘
   - [ ] 패널 내부 스크롤 독립적 동작
   - [ ] 모달과 패널 동시 표시

3. **Firebase 연동**
   - [ ] 설정 변경 시 실시간 반영
   - [ ] 해시태그 추가/수정/삭제
   - [ ] 세미나 태그 설정 변경

## 성능 고려사항

- **onSnapshot 리스너**: 컴포넌트 unmount 시 자동 cleanup
- **조건부 렌더링**: 패널은 isOpen=true일 때만 내용 렌더링
- **최소 리렌더링**: useEffect dependency 최적화

## 디자인 일관성

- 기존 프로젝트 색상 팔레트 사용:
  - Primary: #fdb813 (황금색)
  - Dark: #081429 (네이비)
  - Seminar: amber/orange tones
- Lucide React 아이콘 사용
- Tailwind CSS 유틸리티 클래스
- 반응형 디자인 고려 (mobile에서는 full width 패널)

## 참고 사항

- 기존 출석부 4-quadrant 기능 유지됨
- 등록 요일 주황색 배경 표시 기능 정상 작동
- TypeScript 컴파일 에러 없음 (기존 에러는 무관한 파일)
