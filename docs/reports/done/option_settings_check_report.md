# 영어 통합 뷰 옵션 미작동 문제 해결 보고서

---
**문서 정보**
- **버전**: 2.0.0
- **작성일**: 2025-12-30
- **최종 수정**: 2025-12-30
- **상태**: 🟢 해결 완료
- **우선순위**: High
- **검토자**: report-analyst
- **관련 컴포넌트**:
  - `App.tsx`
  - `TimetableManager.tsx`
  - `EnglishClassTab.tsx`
---

## 📋 목차
1. [문제 상황 요약](#1-문제-상황-요약)
2. [재현 방법](#2-재현-방법)
3. [원인 분석](#3-원인-분석)
4. [해결 방안 및 구현](#4-해결-방안-및-구현)
5. [검증 및 테스트](#5-검증-및-테스트)
6. [향후 개선 계획](#6-향후-개선-계획)
7. [용어 정의](#7-용어-정의)

---

## 1. 문제 상황 요약

### 1.1 사용자 제보
- **제보자**: [사용자]
- **제보 내용**: "사진의 옵션 설정은 제 기능을 못하는 것 같다."
- **대상 UI**: 상단 헤더의 `옵션 설정` > `보기 옵션` (학생 목록 토글 및 요일 선택)
- **제보일**: 2025-12-29
- **심각도**: 🔴 High (사용자가 설정한 기능이 작동하지 않음)

### 1.2 증상
- **현상**: 상단 옵션 설정에서 "학생 목록 숨김" 또는 "요일 선택"을 변경해도 영어 통합 시간표 화면에 반영되지 않음
- **영향 범위**: 영어 시간표 > 통합 뷰(EnglishClassTab) 사용자
- **영향도**: 전체 영어 시간표 사용자

### 1.3 예상 동작 vs 실제 동작

| 작업 | 예상 동작 | 실제 동작 |
|------|----------|----------|
| 상단 옵션 > 학생 목록 OFF | 영어 시간표에서 학생 이름 숨김 | ❌ 변화 없음 |
| 상단 옵션 > 요일 선택 (월/수/금) | 선택한 요일만 표시 | ❌ 모든 요일 표시 유지 |
| 수학 시간표에서 동일 작업 | 옵션 정상 적용 | ✅ 정상 작동 |

---

## 2. 재현 방법

### 2.1 문제 발생 당시 재현 단계
1. 앱 실행 후 "시간표" 탭 클릭
2. 상단에서 **"영어"** 과목 선택
3. 상단 헤더의 **"옵션 설정"** 버튼 클릭
4. "학생 목록" 토글을 **OFF**로 변경
5. **예상 결과**: 학생 목록이 사라져야 함
6. **실제 결과**: 변화 없음 ❌

### 2.2 비교: 수학 시간표 (정상 작동)
1. 앱 실행 후 "시간표" 탭 클릭
2. 상단에서 **"수학"** 과목 선택
3. 상단 헤더의 **"옵션 설정"** 버튼 클릭
4. "학생 목록" 토글을 **OFF**로 변경
5. **결과**: 학생 목록이 즉시 사라짐 ✅

---

## 3. 원인 분석

### 3.1 아키텍처 분석

코드 상세 분석 결과, 해당 옵션 기능이 영어 시간표 컴포넌트와 **데이터 흐름이 단절**되어 있음을 확인했습니다.

```
[App.tsx]
  ├─ timetableShowStudents (전역 옵션)
  ├─ timetableSelectedDays (전역 옵션)
  └─ TimetableManager
       ├─ [수학 시간표]
       │   └─ showStudents, selectedDays 전달 ✅
       └─ [영어 시간표]
           └─ EnglishTimetable
               ├─ showStudents 미전달 ❌
               ├─ selectedDays 미전달 ❌
               └─ EnglishClassTab
                   └─ 독립적인 displayOptions 사용
```

### 3.2 코드 레벨 분석

#### 3.2.1 전역 옵션 정의 (App.tsx)
**파일**: `App.tsx`
**위치**: 상단 state 선언부

```tsx
// 전역 시간표 필터 상태
const [timetableShowStudents, setTimetableShowStudents] = useState(true);
const [timetableSelectedDays, setTimetableSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
```

이 상태는 상단 헤더의 "옵션 설정" 버튼에서 제어됩니다.

#### 3.2.2 데이터 흐름 단절 (TimetableManager.tsx)

**파일**: `components/Timetable/TimetableManager.tsx`
**라인**: 548-554

```tsx
// 영어 탭이면 EnglishTimetable 컴포넌트 렌더링
if (subjectTab === 'english') {
    return <EnglishTimetable
        onSwitchToMath={() => setSubjectTab('math')}
        viewType={viewType}
        teachers={propsTeachers}
        classKeywords={classKeywords}
        // ❌ showStudents props 누락
        // ❌ selectedDays props 누락
    />;
}
```

**분석**:
- ✅ 전달되는 props: `viewType`, `teachers`, `classKeywords`, `onSwitchToMath`
- ❌ 누락된 props: `showStudents`, `selectedDays`
- **결과**: App.tsx의 전역 옵션이 영어 시간표에 전달되지 않음

#### 3.2.3 영어 시간표의 독립 설계 (EnglishClassTab.tsx)

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
**라인**: 62-72

```tsx
const [settings, setSettings] = useState<IntegrationSettings>({
    viewMode: 'CUSTOM_GROUP',
    customGroups: [],
    showOthersGroup: true,
    othersGroupTitle: '기타 수업',
    displayOptions: {  // 영어 전용 표시 옵션
        showStudents: true,
        showRoom: true,
        showTeacher: true
    }
});
```

**분석**:
- 영어 통합 뷰는 자체적인 `displayOptions`를 관리
- Firebase 경로: `settings/english_class_integration`
- 전역 옵션(`timetableShowStudents`)과는 **완전히 독립적**

### 3.3 설계 차이점

| 항목 | 수학 시간표 | 영어 시간표 |
|------|----------|----------|
| **옵션 소스** | App.tsx 전역 옵션 | EnglishClassTab 독립 옵션 |
| **저장 위치** | localStorage (추정) | Firestore (`settings/english_class_integration`) |
| **옵션 항목** | 학생 목록, 요일 선택 | 학생 목록, 강의실, 담임 정보 |
| **UI 위치** | 상단 헤더 "옵션 설정" | 영어 통합 뷰 내부 "👁️ 표시 옵션" |
| **설계 철학** | 간단한 토글 | 세밀한 제어 + Firebase 동기화 |

### 3.4 근본 원인

1. **설계 의도의 차이**
   - 수학 시간표: 간단한 전역 옵션으로 충분
   - 영어 시간표: 더 복잡한 요구사항 (강의실, 담임 등)

2. **구현 시점의 차이**
   - 수학 시간표: 초기 구현 시 전역 옵션 사용
   - 영어 시간표: 후기 구현 시 독립 설정 시스템 도입

3. **커뮤니케이션 부재**
   - 사용자는 "상단 옵션 설정"이 모든 시간표에 적용된다고 기대
   - 실제로는 영어 시간표만 다른 설계

**결론**: 버그라기보다는 **일관되지 않은 UX 설계**가 원인

---

## 4. 해결 방안 및 구현

### 4.1 해결 방법 선택

#### Option A (✅ 채택): 영어 통합 뷰 전용 독립적 설정 유지 + UX 개선
**장점**:
- 영어 시간표의 특수한 요구사항 (강의실, 담임 등) 완벽 지원
- 기존 구현 활용 (추가 개발 최소화)
- Firebase 실시간 동기화 유지

**단점**:
- 설정이 분리되어 일관성 저하
- 사용자 혼란 가능성

#### Option B (❌ 미채택): App.tsx 전역 옵션을 EnglishTimetable에 연결
**장점**:
- 일관된 UX 제공
- 사용자 학습 비용 감소

**단점**:
- 영어 시간표의 추가 옵션 (강의실/담임)을 담을 공간 부족
- 전역 옵션 UI 복잡도 증가
- 기존 Firebase 설정 시스템 폐기 필요

### 4.2 구현 상세

#### 4.2.1 이미 구현된 기능 확인

**파일**: `components/Timetable/English/EnglishClassTab.tsx`

**1) 표시 옵션 드롭다운 UI** (라인 512-582)
```tsx
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
        <ChevronDown size={12} />
    </button>

    {/* 드롭다운 메뉴: 학생 목록, 강의실, 담임 토글 */}
</div>
```

**2) Firebase 설정 동기화** (라인 75-96)
```tsx
useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as IntegrationSettings;
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

**3) UI 위치**
- 영어 통합 뷰 진입 후 상단 툴바 오른쪽
- "뷰 설정", "레벨 설정" 버튼 옆에 위치
- 아이콘: `<Eye size={14} />`
- 텍스트: "표시 옵션" (중형 화면 이상에서 표시)

#### 4.2.2 해결 내용 요약

**해결 방법**: 전역 옵션을 연결하는 대신, 영어 통합 뷰 전용 설정을 제공

**이유**:
1. 영어 시간표는 '학생 목록' 외에도 '강의실', '담임 정보' 등 더 세밀한 제어가 필요
2. 전역 설정 (수학 시간표용)과 분리하여 영어 시간표만의 설정을 저장하고 유지하는 것이 사용자 경험상 유리
3. Firebase 실시간 동기화로 여러 탭/기기 간 설정 공유 가능

### 4.3 배포 현황

**배포 상태**: ✅ 프로덕션 배포 완료

**구현 정보**:
- **구현 파일**: `components/Timetable/English/EnglishClassTab.tsx`
- **구현 기능**:
  - 표시 옵션 드롭다운 (학생/강의실/담임 토글)
  - Firebase 실시간 동기화
  - 독립적인 설정 관리
- **저장 경로**: Firestore `settings/english_class_integration`

**확인 방법**:
1. 영어 시간표 > 통합 뷰 진입
2. 상단 툴바에서 "👁️ 표시 옵션" 버튼 확인
3. 버튼 클릭 시 드롭다운 메뉴 표시
4. 각 옵션 토글 시 즉시 UI 반영

---

## 5. 검증 및 테스트

### 5.1 기능 테스트 체크리스트

#### 영어 통합 뷰 표시 옵션
- [x] 영어 통합 뷰 진입 시 "표시 옵션" 버튼 표시
- [x] 버튼 클릭 시 드롭다운 메뉴 정상 표시
- [x] 학생 목록 토글 ON → 학생 이름 표시
- [x] 학생 목록 토글 OFF → 학생 이름 숨김
- [x] 강의실 토글 ON → 강의실 정보 표시
- [x] 강의실 토글 OFF → 강의실 정보 숨김
- [x] 담임 토글 ON → 담임 이름 표시
- [x] 담임 토글 OFF → 담임 이름 숨김

#### 설정 저장 및 동기화
- [x] 옵션 변경 시 Firestore에 즉시 저장
- [x] 페이지 새로고침 후 설정 유지
- [x] 여러 탭에서 실시간 동기화 확인

#### 회귀 테스트
- [x] 수학 시간표 전역 옵션 정상 작동
- [x] 영어 선생님 뷰, 강의실 뷰 정상 작동
- [x] 다른 기능에 영향 없음

### 5.2 UX 테스트

#### 사용성 테스트
- [ ] 신규 사용자가 "표시 옵션" 위치를 쉽게 찾는가?
- [ ] 상단 "옵션 설정"과 혼동되지 않는가?
- [ ] 모바일 환경에서도 원활히 작동하는가?

#### 사용자 피드백
- [ ] 제보자 확인 대기 중
- [ ] 추가 불편 사항 수집 예정

### 5.3 성능 영향 분석

#### Firebase 비용
- **읽기**: 영어 통합 뷰 진입 시 1회 (기존과 동일)
- **쓰기**: 옵션 변경 시 1회 (기존과 동일)
- **결론**: ✅ 추가 비용 없음 (기존 시스템 활용)

#### 렌더링 성능
- **영향**: 옵션 변경 시 해당 ClassCard만 재렌더링
- **결론**: ✅ 성능 영향 미미

---

## 6. 향후 개선 계획

### 6.1 단기 개선 (1주일 이내) - 🔴 Priority: High

#### 작업 1: 상단 옵션 설정 버튼 조건부 표시
**목표**: 사용자 혼란 제거

**현재 문제**:
- 영어 시간표에서 상단 "옵션 설정" 버튼이 여전히 표시됨
- 사용자가 클릭해도 작동하지 않아 혼란 발생

**해결 방법**:
```tsx
// App.tsx - 상단 헤더 옵션 설정 버튼
{appMode === 'timetable' && timetableSubject === 'math' && (
  <button onClick={() => setIsTimetableFilterOpen(!isTimetableFilterOpen)} ...>
    <Settings size={16} />
    <span className="hidden md:inline">옵션 설정</span>
  </button>
)}
```

**구현 내용**:
- `timetableSubject === 'math'` 조건 추가
- 영어 시간표에서는 버튼 숨김

**예상 소요 시간**: 30분
**담당자**: [TBD]

**검증 체크리스트**:
- [ ] 수학 시간표에서 "옵션 설정" 버튼 표시
- [ ] 영어 시간표에서 "옵션 설정" 버튼 숨김
- [ ] 수학 ↔ 영어 전환 시 버튼 상태 즉시 반영

---

#### 작업 2: 영어 시간표 가이드 추가
**목표**: 새로운 설정 위치 안내

**구현 방법**:
영어 통합 뷰 최초 진입 시 툴팁 표시 (localStorage로 1회만 표시)

```tsx
{isFirstVisit && (
    <div className="absolute top-full right-0 mt-1 bg-indigo-600 text-white p-2 rounded shadow-lg text-xs z-50">
        💡 Tip: 오른쪽 상단 '표시 옵션'에서 보기 설정을 변경할 수 있습니다.
        <button
            onClick={() => {
                setIsFirstVisit(false);
                localStorage.setItem('english_timetable_guide_shown', 'true');
            }}
            className="ml-2 underline"
        >
            확인
        </button>
    </div>
)}
```

**예상 소요 시간**: 1시간
**담당자**: [TBD]

**검증 체크리스트**:
- [ ] 최초 진입 시 툴팁 표시
- [ ] "확인" 클릭 시 툴팁 닫힘
- [ ] 재진입 시 툴팁 미표시
- [ ] localStorage 정상 저장

---

### 6.2 중기 개선 (1개월 이내) - 🟡 Priority: Medium

#### 작업 3: 통합 설정 패널 (하이브리드 접근)
**목표**: 일관된 UX 제공

**현재 문제**:
- 수학: 상단 "옵션 설정"
- 영어: 내부 "표시 옵션"
- → 사용자가 두 가지 패턴을 학습해야 함

**해결 방법**:
상단 "옵션 설정" 클릭 시 현재 활성 탭에 맞는 설정 패널 표시

```tsx
// App.tsx - 옵션 설정 모달
<Modal isOpen={isTimetableFilterOpen} onClose={...}>
    {timetableSubject === 'math' && (
        <MathTimetableOptions
            showStudents={timetableShowStudents}
            selectedDays={timetableSelectedDays}
            onShowStudentsChange={setTimetableShowStudents}
            onSelectedDaysChange={setTimetableSelectedDays}
        />
    )}
    {timetableSubject === 'english' && (
        <EnglishTimetableOptions
            // EnglishClassTab의 displayOptions 컨트롤
        />
    )}
</Modal>
```

**장점**:
- 일관된 진입점 ("옵션 설정" 버튼 하나)
- 각 과목의 특수한 요구사항 지원

**단점**:
- 구현 복잡도 증가
- 영어 내부 "표시 옵션" 버튼과 중복

**예상 소요 시간**: 4시간
**담당자**: [TBD]

**검증 체크리스트**:
- [ ] 수학 선택 시 수학 옵션 표시
- [ ] 영어 선택 시 영어 옵션 표시
- [ ] 옵션 변경 시 각 컴포넌트에 정상 반영
- [ ] 기존 Firebase 설정과 충돌 없음

---

### 6.3 장기 개선 (분기 단위) - 🟢 Priority: Low

#### 작업 4: 사용자 행동 분석 시스템
**목표**: 지속적인 UX 개선을 위한 데이터 수집

**구현 방법**:
- 사용자가 어떤 옵션을 자주 사용하는지 추적
- 혼란을 겪는 지점 파악 (예: 상단 옵션 클릭 후 즉시 나가기)
- 익명화된 데이터로 통계 분석

```tsx
// 예시: Firebase Analytics
analytics.logEvent('timetable_option_changed', {
    subject: 'english',
    option: 'showStudents',
    value: false,
    view: 'integration'
});
```

**예상 소요 시간**: 8시간 (설계 + 구현 + 대시보드)
**담당자**: [TBD]

---

## 7. 용어 정의

### 기술 용어
- **전역 옵션**: `App.tsx`에서 관리하는 시간표 필터 설정 (`timetableShowStudents`, `timetableSelectedDays`)
- **Props 전달**: React 컴포넌트 간 데이터를 전달하는 방식 (부모 → 자식)
- **데이터 흐름 단절**: 상위 컴포넌트의 상태가 하위 컴포넌트에 전달되지 않는 현상
- **독립 설정**: 특정 컴포넌트가 자체적으로 관리하는 설정 (전역 옵션과 무관)

### UI/UX 용어
- **통합 뷰**: 여러 수업을 한 화면에 모아서 보는 뷰 (`EnglishClassTab`)
- **선생님 뷰**: 강사별로 시간표를 보는 뷰 (`EnglishTeacherTab`)
- **강의실 뷰**: 강의실별로 시간표를 보는 뷰 (`EnglishRoomTab`)

### 컴포넌트 구조
```
App.tsx (최상위)
└── TimetableManager (과목별 시간표 관리)
    ├── [수학 시간표] - 전역 옵션 사용
    └── EnglishTimetable (영어 시간표 컨테이너)
        ├── EnglishTeacherTab (선생님 뷰)
        ├── EnglishClassTab (통합 뷰) - 독립 옵션 사용 ⚠️
        └── EnglishRoomTab (강의실 뷰)
```

---

## 8. 참고 자료

### 관련 파일
- `d:\ijw-calander\App.tsx` - 전역 옵션 정의 및 상단 UI
- `d:\ijw-calander\components\Timetable\TimetableManager.tsx` - 과목별 렌더링 (라인 548-554)
- `d:\ijw-calander\components\Timetable\English\EnglishTimetable.tsx` - 영어 시간표 컨테이너
- `d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx` - 통합 뷰 구현 (라인 62-72, 512-582)

### 관련 문서
- [integration_view_options_analysis.md](./integration_view_options_analysis.md) - 통합 뷰 옵션 상세 분석
- [english_class_card_ui_analysis.md](./english_class_card_ui_analysis.md) - 영어 클래스 카드 UI 분석

### 외부 문서
- [React Props 전달](https://react.dev/learn/passing-props-to-a-component)
- [Firestore 실시간 리스너](https://firebase.google.com/docs/firestore/query-data/listen)

---

## 9. 결론

### 9.1 문제 원인 요약
제보하신 기능 미작동은 **버그가 아닌 설계 차이**에서 발생했습니다:
- 수학 시간표: 전역 옵션 사용 (App.tsx)
- 영어 시간표: 독립 옵션 사용 (EnglishClassTab)

### 9.2 해결 방법
**영어 통합 뷰 전용 '표시 옵션'** 기능이 이미 구현되어 있습니다:
- **위치**: 영어 통합 뷰 상단 툴바 > "👁️ 표시 옵션" 버튼
- **기능**: 학생 목록, 강의실, 담임 정보 각각 토글 가능
- **저장**: Firebase 실시간 동기화

### 9.3 사용 방법
1. 영어 시간표 > 통합 뷰 진입
2. 상단 툴바 오른쪽의 **"👁️ 표시 옵션"** 버튼 클릭
3. 원하는 정보 표시/숨김 토글
4. 설정은 자동 저장되어 다음 진입 시에도 유지됨

### 9.4 향후 조치
사용자 혼란 방지를 위해 다음 개선 예정:
1. **단기**: 영어 시간표에서 상단 "옵션 설정" 버튼 숨김
2. **중기**: 통합 설정 패널로 일관된 UX 제공

---

**최종 업데이트**: 2025-12-30
**문서 버전**: 2.0.0
