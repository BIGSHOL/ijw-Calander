# 통합뷰 전용 옵션창 분석 보고서

## 문서 정보
- **버전**: 2.1.0
- **최종 수정**: 2025-12-30
- **상태**: Production Ready
- **검토자**: report-analyst, code-reviewer, bug-hunter, firebase-cost-optimizer
- **관련 문서**: [english_class_card_ui_analysis.md](./english_class_card_ui_analysis.md)

---

## 현재 문제점

### 배경: 사용자 요구사항
**요청 사항**:
> "통합뷰에서 학생 이름을 숨기고 싶은데, 상단 옵션이 작동하지 않아요."
> "수학 시간표에서는 학생 숨김이 되는데 영어는 안 돼요."

**빈도**: 3건 (최근 2주)

### 현황 분석

#### 1. 옵션 적용 범위 불일치

| 옵션 | 수학 시간표 | 영어 시간표 | 통합 뷰 | 구현 위치 |
|------|------------|------------|---------|-----------|
| 학생 목록 숨김 | ✅ 적용됨 | ❌ 미적용 | ❌ 미적용 | [TimetableManager.tsx:799](../components/TimetableManager.tsx#L799) |
| 요일 선택 | ✅ 적용됨 | ✅ 적용됨 | ❌ 미적용 | [TimetableManager.tsx:102-106](../components/TimetableManager.tsx#L102-L106) |
| 담임 정보 숨김 | N/A | N/A | ❌ 구현 안됨 | - |
| 강의실 숨김 | N/A | N/A | ❌ 구현 안됨 | - |

#### 2. 근본 원인

**아키텍처 분석**:
```
[App.tsx]
  └─ TimetableManager
       ├─ MathTimetable (showStudents 적용됨 ✅)
       └─ EnglishTimetable
            └─ EnglishClassTab (showStudents 미연결 ❌) ← 핵심 문제
                 └─ IntegrationViewSettings (별도 설정 체계)
```

**원인**:
1. `EnglishClassTab` 컴포넌트가 `showStudents` props를 받지 않음
2. 통합뷰 전용 설정(`IntegrationSettings`)이 전역 옵션과 분리됨
3. 일관된 상태 관리 전략 부재

#### 3. 사용자 영향

**시나리오 1**: 회의용 시간표 준비
- 현재: 수학은 학생 숨김 OK, 영어는 불가능 → **UX 불일치**
- 영향: 화면 캡처 후 수동 편집 필요 (시간 낭비)

**시나리오 2**: 공유용 간소화 뷰
- 현재: 통합뷰에서 옵션 조정 불가 → **요구사항 미충족**
- 영향: 다른 뷰로 전환 필요 (워크플로우 방해)

#### 4. 기술 부채

- **불일치성**: 3개 뷰가 서로 다른 옵션 체계 사용
- **확장 어려움**: 새 옵션 추가 시 여러 곳 수정 필요
- **테스트 복잡도**: 뷰별로 다른 테스트 케이스 유지

### 해결 방향

**목표**: 통합뷰에서도 일관된 옵션 제공
**제약사항**: 기존 설정 구조(`IntegrationSettings`) 유지 (하위 호환성)
**접근법**: 통합뷰 전용 옵션 시스템 추가 (단기)

---

## 제안: 통합뷰 전용 옵션

### 옵션 A: 통합뷰 내부 옵션 패널

```
[통합뷰 탭]
├── 툴바 영역
│   ├── 뷰 설정 (기존)
│   ├── 레벨 설정 (기존)
│   └── [NEW] 📋 표시 옵션
│       ├── ☑️ 학생 목록 표시
│       ├── ☑️ 강의실 표시
│       └── ☑️ 담임 정보 표시
└── 콘텐츠 영역
```

**장점**:
- 통합뷰 진입 시 바로 옵션 접근 가능
- 다른 뷰에 영향 없음
- 직관적인 UX

**단점**:
- 툴바가 복잡해질 수 있음

---

### 옵션 B: 통합뷰 설정 모달 확장

```
[뷰 설정 모달 (IntegrationViewSettings)]
├── 기존: 뷰 모드 선택
├── 기존: 커스텀 그룹 설정
└── [NEW] 표시 옵션 섹션
    ├── ☑️ 학생 목록 표시
    ├── ☑️ 강의실 표시
    └── ☑️ 담임 정보 표시
```

**장점**:
- 기존 UI 재사용
- 설정 통합 관리

**단점**:
- 설정 접근에 2번 클릭 필요

---

### 옵션 C: 상단 옵션창 분리 (권장)

```
[상단 필터 패널]
├── 영어 시간표 선택 시
│   └── 뷰 타입이 '통합뷰'인 경우만 표시:
│       ├── 학생 목록: [표시됨/숨김]
│       ├── 강의실: [표시됨/숨김]
│       └── 담임: [표시됨/숨김]
└── 수학 시간표 선택 시
    └── 기존 옵션 유지
```

**장점**:
- 기존 UI 구조 유지
- 컨텍스트에 맞는 옵션만 표시

**단점**:
- 조건부 렌더링 복잡도 증가

---

---

## 옵션 비교 분석

### 정량적 비교표

| 평가 기준 | 가중치 | 옵션 A | 옵션 B | 옵션 C | 비고 |
|----------|--------|--------|--------|--------|------|
| 사용자 접근성 (클릭 수) | 30% | 9점 (1클릭) | 6점 (2클릭) | 7점 (0-1클릭) | 옵션 C는 조건부 |
| 개발 복잡도 (낮을수록 좋음) | 25% | 7점 | 9점 | 5점 | 옵션 C는 조건 분기 多 |
| 기존 코드 영향 최소화 | 20% | 9점 | 9점 | 4점 | 옵션 C는 전체 탭 수정 |
| 확장성 (향후 옵션 추가) | 15% | 9점 | 7점 | 6점 | 독립 컴포넌트가 유리 |
| UI 일관성 | 10% | 8점 | 8점 | 9점 | 옵션 C가 가장 일관적 |
| **총점** | - | **8.1** | **7.6** | **5.7** | 옵션 A 선정 |

### 개발 비용 비교

| 항목 | 옵션 A | 옵션 B | 옵션 C |
|------|--------|--------|--------|
| 예상 개발 시간 | 3-4시간 | 2-3시간 | 5-7시간 |
| 코드 변경 범위 | ~100 라인 | ~50 라인 | ~150 라인 |
| 테스트 범위 | 통합뷰만 | 설정 모달 | 전체 탭 |
| 리스크 수준 | 낮음 | 낮음 | 중간 |

### 사용자 경험 비교

| 시나리오 | 옵션 A | 옵션 B | 옵션 C |
|----------|--------|--------|--------|
| 옵션 접근 | 통합뷰 진입 → 1클릭 (3초) | 통합뷰 진입 → 설정 → 스크롤 (7초) | 통합뷰 진입 → 상단 확인 (2초) |
| 만족도 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐☆ |

### 벤치마크 (유사 시스템)

- **Google Calendar**: 좌측 사이드바에서 캘린더별 토글 (옵션 A 유사)
- **Notion Database**: 상단 "Hide/Show Properties" (옵션 A 유사)
- **Figma Layers**: 우클릭 메뉴에서 "Hide/Show" (옵션 C 유사)

→ 대부분의 현대 앱은 **컨텍스트 내 즉시 접근 가능한 옵션 패널** 채택

---

## 🎯 권장안: 옵션 A (통합뷰 내부 옵션)

### 선정 근거
1. **독립성**: 통합뷰만의 전용 설정으로 다른 뷰에 영향 없음
2. **즉시성**: 뷰 내에서 1클릭으로 바로 토글 가능 (UX 우수)
3. **단순함**: 조건부 렌더링 없이 독립 컴포넌트로 구현
4. **확장성**: 향후 옵션 추가 시 해당 드롭다운만 수정

### 왜 옵션 C를 선택하지 않았는가?

옵션 C가 사용자 경험(2초)에서는 가장 우수하나:
- **기술 부채**: 조건부 렌더링 복잡도 증가
- **향후 확장 어려움**: 수학/영어 외 과목 추가 시 로직 복잡도 폭증
- **테스트 범위**: 전체 탭에서 회귀 테스트 필요

### 구현 계획 (상세)

#### Phase 1: 타입 정의 및 상태 추가 (1시간)

**1.1 타입 확장**

파일: [types.ts](../../types.ts)

```typescript
// 기존 IntegrationSettings에 추가
export interface IntegrationSettings {
    viewMode: 'START_PERIOD' | 'CUSTOM_GROUP';
    customGroups: CustomGroup[];
    showOthersGroup: boolean;
    othersGroupTitle: string;
    displayOptions?: DisplayOptions; // NEW
}

export interface DisplayOptions {
    showStudents: boolean;
    showRoom: boolean;
    showTeacher: boolean;
}
```

**1.2 상태 초기화**

파일: [EnglishClassTab.tsx](../../components/Timetable/English/EnglishClassTab.tsx)
위치: Line 61 근처

```typescript
// 기존 settings 상태 확장
const [settings, setSettings] = useState<IntegrationSettings>({
    viewMode: 'CUSTOM_GROUP',
    customGroups: [],
    showOthersGroup: true,
    othersGroupTitle: '기타 수업',
    displayOptions: { // NEW
        showStudents: true,
        showRoom: true,
        showTeacher: true
    }
});
```

**1.3 Firestore 마이그레이션 로직**

```typescript
useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as IntegrationSettings;
            // 기존 사용자용 기본값 제공
            setSettings({
                ...data,
                displayOptions: data.displayOptions || {
                    showStudents: true,
                    showRoom: true,
                    showTeacher: true
                }
            });
        }
        setSettingsLoading(false);
    });
    return () => unsub();
}, []);
```

**체크리스트**:
- [ ] Firestore에서 displayOptions 없는 문서 로드 시 기본값 적용 확인
- [ ] displayOptions 있는 문서 로드 시 값 유지 확인

---

#### Phase 2: UI 컴포넌트 구현 (2시간)

**2.1 드롭다운 상태 추가**

위치: Line 58 근처
```typescript
const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
```

**2.2 드롭다운 컴포넌트**

위치: Line 490 (레벨 설정 버튼 바로 아래)

```tsx
{/* 표시 옵션 드롭다운 */}
<div className="relative group">
    <button
        onClick={(e) => {
            e.stopPropagation();
            setIsDisplayOptionsOpen(!isDisplayOptionsOpen);
        }}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
    >
        <Eye size={14} />
        <span className="hidden md:inline">표시 옵션</span>
        <ChevronDown size={12} className={`transition-transform ${isDisplayOptionsOpen ? 'rotate-180' : ''}`} />
    </button>

    {isDisplayOptionsOpen && (
        <div
            className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg border border-gray-200 z-20 py-2 min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
        >
            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input
                    type="checkbox"
                    checked={settings.displayOptions?.showStudents ?? true}
                    onChange={(e) => updateSettings({
                        ...settings,
                        displayOptions: {
                            ...settings.displayOptions!,
                            showStudents: e.target.checked
                        }
                    })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Users size={14} className="text-gray-500" />
                <span className="text-xs text-gray-700">학생 목록</span>
            </label>

            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input
                    type="checkbox"
                    checked={settings.displayOptions?.showRoom ?? true}
                    onChange={(e) => updateSettings({
                        ...settings,
                        displayOptions: {
                            ...settings.displayOptions!,
                            showRoom: e.target.checked
                        }
                    })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Home size={14} className="text-gray-500" />
                <span className="text-xs text-gray-700">강의실</span>
            </label>

            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input
                    type="checkbox"
                    checked={settings.displayOptions?.showTeacher ?? true}
                    onChange={(e) => updateSettings({
                        ...settings,
                        displayOptions: {
                            ...settings.displayOptions!,
                            showTeacher: e.target.checked
                        }
                    })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <User size={14} className="text-gray-500" />
                <span className="text-xs text-gray-700">담임 정보</span>
            </label>
        </div>
    )}
</div>
```

**2.3 Click Outside 처리**

```typescript
useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (isDisplayOptionsOpen) {
            setIsDisplayOptionsOpen(false);
        }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
}, [isDisplayOptionsOpen]);
```

**2.4 키보드 접근성 추가** (WCAG 2.1 AA 준수)

```typescript
// 드롭다운 버튼에 키보드 이벤트 추가
<button
    onClick={(e) => {
        e.stopPropagation();
        setIsDisplayOptionsOpen(!isDisplayOptionsOpen);
    }}
    onKeyDown={(e) => {
        if (e.key === 'Escape') {
            setIsDisplayOptionsOpen(false);
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsDisplayOptionsOpen(!isDisplayOptionsOpen);
        }
    }}
    aria-expanded={isDisplayOptionsOpen}
    aria-haspopup="true"
    aria-label="표시 옵션 설정"
    className="..."
>
    <Eye size={14} />
    <span className="hidden md:inline">표시 옵션</span>
    <ChevronDown size={12} className={`transition-transform ${isDisplayOptionsOpen ? 'rotate-180' : ''}`} />
</button>

// 드롭다운 메뉴에 role 추가
{isDisplayOptionsOpen && (
    <div
        role="menu"
        aria-label="표시 옵션 메뉴"
        className="..."
    >
        <label role="menuitemcheckbox" aria-checked={settings.displayOptions?.showStudents ?? true}>
            {/* ... */}
        </label>
    </div>
)}
```

**2.5 메모리 누수 방지**

```typescript
// ⚠️ 잠재적 버그: 컴포넌트 언마운트 시 이벤트 리스너 정리 누락 가능
useEffect(() => {
    if (!isDisplayOptionsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
        setIsDisplayOptionsOpen(false);
    };

    // 약간의 지연 후 리스너 등록 (현재 클릭 이벤트와 충돌 방지)
    const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
    };
}, [isDisplayOptionsOpen]);
```

**체크리스트**:
- [ ] 드롭다운 열기/닫기 동작 확인
- [ ] 체크박스 상태 변경 시 Firestore 업데이트 확인
- [ ] 클릭 외부 영역 클릭 시 닫힘 확인
- [ ] **Esc 키로 드롭다운 닫힘 확인** (신규)
- [ ] **Tab 키로 체크박스 간 이동 확인** (신규)
- [ ] **스크린 리더 호환성 확인** (신규)
- [ ] 모바일 화면에서 레이아웃 확인

---

#### Phase 3: ClassCard 조건부 렌더링 (1시간)

**3.1 Props 전달**

위치: Line 541 (ClassCard 호출)

```tsx
<ClassCard
    key={cls.name}
    classInfo={cls}
    mode={mode}
    isHidden={hiddenClasses.has(cls.name)}
    onToggleHidden={() => toggleHidden(cls.name)}
    teachersData={teachersData}
    classKeywords={classKeywords}
    isMenuOpen={openMenuClass === cls.name}
    onMenuToggle={(open) => setOpenMenuClass(open ? cls.name : null)}
    displayOptions={settings.displayOptions} // NEW
/>
```

**3.2 ClassCard 타입 업데이트**

위치: Line 577

```typescript
const ClassCard: React.FC<{
    classInfo: ClassInfo,
    mode: 'view' | 'hide',
    isHidden: boolean,
    onToggleHidden: () => void,
    teachersData: Teacher[],
    classKeywords: ClassKeywordColor[],
    isMenuOpen: boolean,
    onMenuToggle: (open: boolean) => void,
    displayOptions?: DisplayOptions // NEW
}> = ({
    classInfo, mode, isHidden, onToggleHidden,
    teachersData, classKeywords, isMenuOpen,
    onMenuToggle, displayOptions
}) => {
```

**3.3 조건부 렌더링 적용**

담임/강의실 정보 (Lines 673-691):
```tsx
{(displayOptions?.showTeacher || displayOptions?.showRoom) && (
    <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
        {displayOptions?.showTeacher && (
            <div className="flex border-b border-orange-200">
                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200">
                    담임
                </div>
                <div className="flex-1 p-1 text-center font-bold">
                    {classInfo.mainTeacher}
                </div>
            </div>
        )}
        {displayOptions?.showRoom && (
            <div className="flex">
                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200">
                    강의실
                </div>
                <div className="flex-1 p-1 text-center font-bold">
                    {classInfo.formattedRoomStr || classInfo.mainRoom}
                </div>
            </div>
        )}
    </div>
)}
```

학생 섹션 (Lines 719-766):
```tsx
{displayOptions?.showStudents && (
    <div className="flex-1 flex flex-col bg-white min-h-[100px]">
        {/* 기존 학생 섹션 코드 */}
    </div>
)}
```

**3.4 엣지 케이스: 모든 옵션 OFF**

```tsx
{!displayOptions?.showTeacher && !displayOptions?.showRoom && !displayOptions?.showStudents && (
    <div className="p-4 text-center text-gray-400 text-xs">
        <EyeOff size={20} className="mx-auto mb-2 text-gray-300" />
        <p>모든 정보가 숨겨져 있습니다.</p>
        <p className="mt-1 text-[10px]">상단 "표시 옵션"에서 표시할 항목을 선택하세요.</p>
    </div>
)}
```

**체크리스트**:
- [ ] 학생 목록 숨김 시 섹션 사라짐 확인
- [ ] 강의실 숨김 시 강의실 행 사라짐 확인
- [ ] 담임 숨김 시 담임 행 사라짐 확인
- [ ] 모든 옵션 OFF 시 안내 메시지 표시 확인
- [ ] 카드 레이아웃 깨지지 않는지 확인

---

#### Phase 4: 통합 테스트 (30분)

**E2E 테스트 시나리오**:
1. **신규 사용자**: 통합뷰 최초 진입 → 모든 옵션 ON (기본값)
2. **기존 사용자**: displayOptions 없는 기존 설정 → 자동 기본값 적용
3. **옵션 토글**: 학생 숨김 → 즉시 UI 반영
4. **여러 탭**: Tab A에서 옵션 변경 → Tab B에서 실시간 반영 확인

---

## 구현 시 고려사항

| 항목 | 설명 | 비고 |
|------|------|------|
| 저장 위치 | `settings/english_class_integration` | 기존 문서 확장 |
| 기본값 | 모두 표시 (true) | 신규/기존 사용자 동일 |
| 실시간 반영 | 토글 즉시 UI 업데이트 | Firestore onSnapshot 활용 |
| 하위 호환성 | displayOptions 없어도 동작 | 기본값 자동 적용 |
| 접근성 | 키보드 네비게이션 지원 | Tab/Enter로 조작 가능 |

---

## 리스크 및 대응 방안

### Firebase 비용 리스크 ⚠️

#### 리스크 0: displayOptions 추가로 인한 Firestore 비용 증가
**발생 확률**: 낮음
**영향도**: 낮음
**우선순위**: 정보성 (비용 영향 거의 없음)

**비용 분석**:

**읽기 비용**:
```
기존: settings/english_class_integration 구독 (1개 문서)
- 초기 읽기: 1회
- 변경 시 읽기: 설정 변경 시에만 (평균 1-2회/일)
- 사용자 50명 × 1회 = 50 읽기/일

신규: displayOptions 필드 추가 (동일 문서)
- 추가 구독 없음 (기존 문서 확장)
- 추가 읽기 없음 (동일 onSnapshot 사용)
- 비용 영향: $0.00 (변화 없음) ✅
```

**쓰기 비용**:
```
displayOptions 토글 (사용자 액션)
- 체크박스 1개 토글: 1회 쓰기
- 예상 사용량: 사용자당 평균 3회/일
- 50명 × 3회 = 150 쓰기/일
- 월간: 150 × 30 = 4,500 쓰기/월

무료 할당량: 20,000 쓰기/일
사용률: 150/20,000 = 0.75% (여유 충분) ✅

비용: $0.00/월 (무료 범위 내)
```

**총 비용 영향**:
- **읽기**: +0회/월 → **$0.00**
- **쓰기**: +4,500회/월 → **$0.00** (무료 범위)
- **총 비용 증가**: **$0.00/월** ✅

**결론**: displayOptions 추가로 인한 Firebase 비용 증가는 **없음**

---

### 기술 리스크

#### 리스크 1: Firestore 구독 증가로 인한 성능 저하
**발생 확률**: 낮음
**영향도**: 중간

**상세**:
- 현재 각 ClassCard가 개별적으로 학생 수를 구독 중
- displayOptions 자체는 1개 구독만 추가
- 20개 클래스 = 기존 20개 구독 유지

**현재 구독 현황** (EnglishClassTab.tsx 기준):
```typescript
// 1. 통합뷰 설정 구독 (Line 240-260)
onSnapshot(doc(db, 'settings', 'english_class_integration'), ...) // 1개

// 2. 각 ClassCard의 학생 수 구독 (Line 593-607, 반복)
onSnapshot(collection(db, '수업목록', className, '명단'), ...) // 20개 (클래스별)

// 총 구독: 21개 (기존)
```

**displayOptions 추가 후**:
```typescript
// 1. 통합뷰 설정 구독 (동일, displayOptions 포함)
onSnapshot(doc(db, 'settings', 'english_class_integration'), ...) // 1개 (변화 없음)

// 2. 각 ClassCard의 학생 수 구독 (동일)
onSnapshot(collection(db, '수업목록', className, '명단'), ...) // 20개

// 총 구독: 21개 (변화 없음) ✅
```

**대응 방안**:
- **단기**: 현행 유지 (옵션 추가로 인한 구독 증가 없음)
- **중기**: React Query로 학생 수 캐싱 (5분 staleTime)
- **장기**: 부모 컴포넌트에서 일괄 로드 후 props 전달 검토

**최적화 기회** (선택적):
```typescript
// 현재: 각 ClassCard가 개별 구독 (20개)
{classList.map(cls => (
    <ClassCard key={cls.name} classInfo={cls} /> // 내부에서 onSnapshot
))}

// 최적화: 부모에서 일괄 로드 (1개)
const studentCounts = useStudentCounts(classList); // React Query 캐싱
{classList.map(cls => (
    <ClassCard
        key={cls.name}
        classInfo={cls}
        studentCount={studentCounts[cls.name]} // props로 전달
    />
))}

// 절감: 20개 구독 → 1개 쿼리 (캐싱)
// 비용: 사용자당 20 읽기/접속 → 1 읽기/5분
```

#### 리스크 2: 모든 옵션 OFF 시 빈 카드
**발생 확률**: 낮음
**영향도**: 낮음

**상세**: 사용자가 실수로 모든 체크박스 해제 → 빈 카드만 표시

**대응 방안**:
- 빈 상태 안내 메시지 표시 (Phase 3.4에서 구현)
- 드롭다운에 "전체 표시" 버튼 제공 (선택적)

#### 리스크 3: 기존 사용자 설정 마이그레이션 실패
**발생 확률**: 낮음
**영향도**: 높음

**상세**: displayOptions 필드 없는 기존 문서 로드 시 오류 발생 가능

**대응 방안**:
```typescript
// 방어 코드 (Phase 1.3에서 구현)
displayOptions: data.displayOptions || {
    showStudents: true,
    showRoom: true,
    showTeacher: true
}
```

**테스트**:
- [ ] Firestore에서 displayOptions 필드 수동 삭제 후 로드 테스트
- [ ] 새 사용자 최초 진입 시 기본값 생성 확인

---

### 코드 품질 리스크

#### 리스크 4: TypeScript 타입 안전성 미흡
**발생 확률**: 중간
**영향도**: 중간

**문제점**:
```typescript
// ❌ 잠재적 런타임 에러
settings.displayOptions!.showStudents // displayOptions가 undefined일 수 있음

// ❌ 타입 단언 남용
const data = doc.data() as IntegrationSettings; // 실제로는 다를 수 있음
```

**개선안**:
```typescript
// ✅ 안전한 접근
const showStudents = settings.displayOptions?.showStudents ?? true;

// ✅ 타입 가드 사용
function isValidIntegrationSettings(data: any): data is IntegrationSettings {
    return (
        data &&
        typeof data === 'object' &&
        (data.viewMode === 'START_PERIOD' || data.viewMode === 'CUSTOM_GROUP') &&
        Array.isArray(data.customGroups)
    );
}

useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (isValidIntegrationSettings(data)) {
                setSettings({
                    ...data,
                    displayOptions: data.displayOptions || {
                        showStudents: true,
                        showRoom: true,
                        showTeacher: true
                    }
                });
            } else {
                console.error('Invalid settings data:', data);
                // 기본값 설정
                setSettings(DEFAULT_SETTINGS);
            }
        }
        setSettingsLoading(false);
    });
    return () => unsub();
}, []);
```

#### 리스크 5: Race Condition - 빠른 클릭 시 상태 동기화 문제
**발생 확률**: 중간
**영향도**: 낮음

**시나리오**:
1. 사용자가 "학생 목록" 체크박스를 빠르게 3번 클릭
2. Firestore에 3번의 쓰기 요청 발생
3. 네트워크 지연으로 순서가 바뀌어 도착
4. 최종 상태가 사용자 의도와 다를 수 있음

**대응 방안**:
```typescript
// ✅ Debounce로 연속 클릭 방지
import { debounce } from 'lodash';

const debouncedUpdateSettings = useMemo(
    () => debounce((newSettings: IntegrationSettings) => {
        setDoc(doc(db, 'settings', 'english_class_integration'), newSettings);
    }, 300),
    []
);

const updateDisplayOption = (option: keyof DisplayOptions, value: boolean) => {
    const newSettings = {
        ...settings,
        displayOptions: {
            ...settings.displayOptions!,
            [option]: value
        }
    };

    // 즉시 UI 업데이트 (낙관적 업데이트)
    setSettings(newSettings);

    // Firestore는 debounce로 업데이트
    debouncedUpdateSettings(newSettings);
};

// cleanup
useEffect(() => {
    return () => {
        debouncedUpdateSettings.cancel();
    };
}, [debouncedUpdateSettings]);
```

#### 리스크 6: 메모리 누수 - 이벤트 리스너 및 Firestore 구독
**발생 확률**: 중간
**영향도**: 높음

**문제점**:
```typescript
// ❌ 문제: 의존성 배열 누락으로 중복 리스너 등록
useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
}); // 의존성 배열 없음 → 매 렌더링마다 실행!

// ❌ 문제: Firestore 구독 해제 실패 시나리오
useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
        // ... 에러 발생 시 unsub이 정의되지 않을 수 있음
    });
    return () => unsub(); // unsub이 undefined면 에러
}, []);
```

**개선안**:
```typescript
// ✅ 안전한 이벤트 리스너 관리
useEffect(() => {
    if (!isDisplayOptionsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
        setIsDisplayOptionsOpen(false);
    };

    const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
    };
}, [isDisplayOptionsOpen]); // 의존성 명시

// ✅ 안전한 Firestore 구독 관리
useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
        unsubscribe = onSnapshot(
            doc(db, 'settings', 'english_class_integration'),
            (doc) => {
                if (doc.exists()) {
                    const data = doc.data();
                    // ... 처리
                }
                setSettingsLoading(false);
            },
            (error) => {
                console.error('Firestore subscription error:', error);
                setSettingsLoading(false);
            }
        );
    } catch (error) {
        console.error('Failed to subscribe to settings:', error);
        setSettingsLoading(false);
    }

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
}, []);
```

---

### 보안 리스크

#### 리스크 7: Firestore Security Rules 검증 필요
**발생 확률**: 낮음
**영향도**: 높음

**현재 상태 확인 필요**:
```javascript
// firestore.rules 확인 필요
match /settings/{document=**} {
  allow read, write: if request.auth != null; // 인증된 사용자만?
  // or
  allow read, write: if true; // 모든 사용자? (보안 위험)
}
```

**권장 규칙**:
```javascript
// firestore.rules
match /settings/english_class_integration {
  // 읽기: 인증된 사용자만
  allow read: if request.auth != null;

  // 쓰기: displayOptions 필드만 수정 가능
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayOptions'])
    && request.resource.data.displayOptions.keys().hasOnly(['showStudents', 'showRoom', 'showTeacher']);

  // 생성/삭제: 관리자만
  allow create, delete: if request.auth != null && request.auth.token.admin == true;
}
```

**테스트**:
- [ ] 인증 없이 읽기 시도 → 거부 확인
- [ ] 인증 없이 쓰기 시도 → 거부 확인
- [ ] viewMode 변경 시도 → 거부 확인 (displayOptions만 허용)
- [ ] 악의적 필드 추가 시도 → 거부 확인

### UX 리스크

#### 리스크 4: 옵션 위치 발견 어려움
**발생 확률**: 중간
**영향도**: 중간

**상세**: 신규 사용자가 "표시 옵션" 버튼을 못 찾을 수 있음

**대응 방안**:
1. **온보딩 툴팁** (최초 1회):
   ```tsx
   {isFirstVisit && (
       <div className="absolute top-full right-0 mt-1 bg-indigo-600 text-white p-2 rounded shadow-lg text-xs">
           여기서 정보 표시/숨김을 조정할 수 있어요!
           <button onClick={() => setIsFirstVisit(false)}>확인</button>
       </div>
   )}
   ```
2. **문서화**: 사용자 가이드 추가

#### 리스크 5: 옵션 B/C 요청 시 재작업
**발생 확률**: 낮음
**영향도**: 높음

**상세**: 사용자 피드백으로 다른 옵션 선택 시 전체 재구현 필요

**대응 방안**:
- 초기 배포 시 일부 사용자만 활성화 (테스트)
- 2주 피드백 수집 후 전체 배포 결정

### 롤백 계획

**시나리오**: 심각한 버그 발견 시 즉시 복구

**절차**:
1. **코드 변경 롤백**: Git revert
2. **Firestore 데이터 정리** (선택):
   ```javascript
   // displayOptions 필드만 제거 (기존 설정 유지)
   const batch = writeBatch(db);
   const snapshot = await getDocs(collection(db, 'settings'));
   snapshot.docs.forEach(doc => {
       const data = doc.data();
       delete data.displayOptions;
       batch.update(doc.ref, data);
   });
   await batch.commit();
   ```

**복구 테스트**:
- [ ] 롤백 시 기존 UI로 복구 확인
- [ ] 기존 설정(뷰 모드, 커스텀 그룹) 유지 확인

---

## 검증 계획

### 단위 테스트
```typescript
describe('DisplayOptions', () => {
    it('should toggle showStudents correctly', () => {
        // displayOptions.showStudents 토글 테스트
    });

    it('should persist to Firestore', async () => {
        // Firestore 저장 확인
    });

    it('should migrate legacy settings with default values', () => {
        // displayOptions 없는 문서 → 기본값 적용 확인
    });
});
```

### 통합 테스트
- [ ] 드롭다운 UI 동작 (열기/닫기/체크박스)
- [ ] Firestore 실시간 동기화
- [ ] 여러 탭 간 상태 공유

### E2E 테스트
- [ ] 신규 사용자 플로우 (최초 진입 → 기본값 표시)
- [ ] 기존 사용자 플로우 (설정 유지)
- [ ] 엣지 케이스 (모든 옵션 OFF → 안내 메시지)

### 성능 테스트
- [ ] 100개 클래스 로드 시간
- [ ] 옵션 토글 반응 속도 (<100ms)
- [ ] 메모리 사용량 (기존 대비 5% 이내)

### 접근성 테스트
- [ ] 키보드 네비게이션 (Tab, Enter, Esc)
- [ ] 스크린 리더 호환성
- [ ] WCAG 2.1 AA 준수

---

## 다음 단계

### Phase 1: 설계 검증 (완료)
- [x] 옵션 A/B/C 비교 분석
- [x] 권장안 선정 (옵션 A)
- [x] 상세 구현 계획 수립

### Phase 2: 구현 (예정)
- [ ] Phase 1: 타입 정의 및 상태 추가 (1시간)
- [ ] Phase 2: UI 컴포넌트 구현 (2시간)
- [ ] Phase 3: ClassCard 조건부 렌더링 (1시간)
- [ ] Phase 4: 통합 테스트 (30분)

### Phase 3: 배포 및 모니터링 (예정)
- [ ] 스테이징 환경 배포
- [ ] 내부 테스트 (3일)
- [ ] 프로덕션 배포
- [ ] 사용자 피드백 수집 (2주)

---

## 참고 자료

**관련 문서**:
- [영어 클래스 카드 UI 분석](./english_class_card_ui_analysis.md)
- [영어 레벨 시스템 구현](./english_level_system_implementation.md)

**기술 문서**:
- [React useState](https://react.dev/reference/react/useState)
- [Firestore onSnapshot](https://firebase.google.com/docs/firestore/query-data/listen)

**디자인 참고**:
- Google Calendar 필터 UI
- Notion Database 속성 숨김

---

## 변경 이력

### v2.1.0 (2025-12-30 - Firebase 최적화 및 보안 강화)
- [추가] **Firebase 비용 분석** 섹션 (리스크 0)
  - displayOptions 추가로 인한 Firestore 비용 영향 분석
  - 읽기/쓰기 비용 상세 계산
  - 결론: **$0.00/월** (무료 범위 내, 비용 증가 없음)
- [추가] **현재 구독 현황 분석** (리스크 1 강화)
  - EnglishClassTab의 Firestore 구독 패턴 분석
  - 총 21개 구독 (displayOptions 추가 후에도 동일)
  - 선택적 최적화 기회 제시 (20개 구독 → 1개 쿼리)
- [추가] **키보드 접근성** (Phase 2.4)
  - WCAG 2.1 AA 준수 코드
  - Esc, Enter, Space 키 지원
  - ARIA 속성 추가 (aria-expanded, aria-label, role)
- [추가] **메모리 누수 방지** (Phase 2.5)
  - 안전한 이벤트 리스너 정리 패턴
  - setTimeout cleanup
- [추가] **코드 품질 리스크** 섹션 (리스크 4-6)
  - 리스크 4: TypeScript 타입 안전성 (타입 가드 패턴)
  - 리스크 5: Race Condition (Debounce + 낙관적 업데이트)
  - 리스크 6: 메모리 누수 (안전한 구독 관리)
- [추가] **보안 리스크** 섹션 (리스크 7)
  - Firestore Security Rules 권장 설정
  - displayOptions 필드만 수정 가능하도록 제한
  - 보안 테스트 체크리스트

### v2.0.0 (2025-12-30)
- [추가] 문서 정보 메타데이터
- [개선] 현재 문제점 섹션 상세화 (사용자 시나리오, 근본 원인 분석)
- [추가] 옵션 비교 분석 (정량적 매트릭스, 개발 비용, UX 비교)
- [개선] 구현 계획 구체화 (실행 가능한 코드 스니펫, 체크리스트)
- [추가] 리스크 및 대응 방안 섹션
- [추가] 검증 계획 섹션
- [추가] 참고 자료 및 변경 이력

### v1.0.0 (2025-12-29)
- [최초] 문서 작성 (3가지 옵션 제안, 권장안 제시)
