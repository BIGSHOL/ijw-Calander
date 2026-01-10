# 🐛 키워드 색상 버그 수정 리포트

**작성일**: 2025-12-30
**버그**: 키워드 색상이 시간표에 적용되지 않음
**상태**: 🟡 **부분 해결** (1/3 완료)
**우선순위**: ⭐⭐⭐⭐ (높음 - 사용자가 설정한 기능이 작동 안 함)

---

## 📋 버그 현상

사용자가 설정 > 수업 관리에서 키워드 색상을 설정했지만, 실제 시간표에서 색상이 적용되지 않음.

### 영향받는 화면
| 화면 | 상태 | 비고 |
|------|------|------|
| **선생님뷰** (EnglishTeacherTab) | ✅ **정상 작동** | 키워드 색상 적용됨 |
| **강의실뷰** (EnglishRoomTab) | ✅ **정상 작동** | 키워드 색상 적용됨 |
| **통합뷰** (EnglishClassTab) | ❌ **버그 발생** | 키워드 색상 미적용 |

---

## 🔍 근본 원인 분석

### 1. 정상 작동하는 코드 (EnglishTeacherTab & EnglishRoomTab)

#### 위치
- `ijw-Calander/components/Timetable/English/EnglishTeacherTab.tsx:707-718`
- `ijw-Calander/components/Timetable/English/EnglishRoomTab.tsx` (유사)

#### 구현 코드
```tsx
{cellData?.className && (
    (() => {
        const matchedKw = classKeywords.find(kw => cellData.className?.includes(kw.keyword));
        return (
            <div
                className={`font-bold leading-tight px-0.5 text-center break-words w-full ...`}
                style={matchedKw ? {
                    backgroundColor: matchedKw.bgColor,
                    color: matchedKw.textColor,
                    borderRadius: '4px',
                    padding: '2px 4px'
                } : {}}
            >
                {cellData.className}
            </div>
        );
    })()
)}
```

#### 작동 방식
1. `cellData.className`을 렌더링
2. `classKeywords.find()`로 매칭되는 키워드 검색
3. 매칭되면 `matchedKw.bgColor`와 `matchedKw.textColor` 적용
4. ✅ **정상 작동**

---

### 2. 버그가 있는 코드 (EnglishClassTab)

#### 위치
- `ijw-Calander/components/Timetable/English/EnglishClassTab.tsx:651-666`

#### 문제 코드
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string  // ← props로 className을 받지만 사용 안 함!
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className }) => {
    // ...

    return (
        <div key={day} className="..." style={style}>
            {cell ? (
                <span className="leading-tight line-clamp-2 break-all">
                    {cell.teacher}  {/* ❌ teacher만 표시! className은 무시됨 */}
                </span>
            ) : (
                <span className="text-gray-200">-</span>
            )}
        </div>
    );
};
```

#### 문제점
1. **`className` props를 받지만 렌더링하지 않음** (660번 줄)
2. **`cell.teacher`만 표시** - 강사 이름만 보임
3. **`classKeywords`를 전달받지도, 사용하지도 않음**
4. **키워드 매칭 로직 자체가 없음**

---

## ✅ 구현 체크리스트

### 🎯 Phase 1: MiniGridRow 컴포넌트 수정

#### Step 1: Props 타입 정의 수정
**파일**: `components/Timetable/English/EnglishClassTab.tsx` (라인 ~651)

- [ ] `ClassKeywordColor` 타입을 import 확인
- [ ] `MiniGridRow` 컴포넌트의 Props 인터페이스에 `classKeywords` 추가
- [ ] 함수 파라미터에 `classKeywords` destructuring 추가

**예상 소요 시간**: 2분

---

#### Step 2: 키워드 매칭 로직 구현
**파일**: `components/Timetable/English/EnglishClassTab.tsx` (라인 ~660)

- [ ] `classKeywords.find()` 로직 추가하여 매칭된 키워드 찾기
- [ ] `getTeacherColor()` 함수 호출하여 기본 강사 색상 가져오기
- [ ] 우선순위 로직 구현: 키워드 색상 > 강사 색상
- [ ] `finalStyle` 변수 생성

**예상 소요 시간**: 5분

---

#### Step 3: 렌더링 로직 변경
**파일**: `components/Timetable/English/EnglishClassTab.tsx` (라인 ~665)

- [ ] `<div>` 엘리먼트에 `finalStyle` 적용
- [ ] `className` (수업명) 렌더링 추가
- [ ] `cell.teacher` (강사명) 작은 글씨로 하위에 표시
- [ ] `title` 속성에 전체 정보 표시 (수업명 + 강사명)

**예상 소요 시간**: 6분

---

#### Step 4: 부모 컴포넌트에서 Props 전달
**파일**: `components/Timetable/English/EnglishClassTab.tsx` (라인 ~549-558)

- [ ] `<MiniGridRow>` 컴포넌트 호출 시 `classKeywords` prop 추가
- [ ] `classKeywords`가 상위에서 제대로 로드되는지 확인 (useSettingsStore)

**예상 소요 시간**: 2분

---

### 🧪 Phase 2: 테스트 및 검증

#### Step 5: 기능 테스트
- [ ] 개발 서버 실행 (`npm start`)
- [ ] 설정 > 수업 관리에서 테스트 키워드 색상 설정 (예: "PL" - 빨강 배경, 흰색 글자)
- [ ] 시간표 > 통합뷰로 이동
- [ ] 키워드가 포함된 수업에 색상이 적용되는지 확인
- [ ] 수업명과 강사명이 모두 표시되는지 확인

**예상 소요 시간**: 5분

---

#### Step 6: 회귀 테스트
- [ ] 선생님뷰에서 키워드 색상 여전히 작동하는지 확인
- [ ] 강의실뷰에서 키워드 색상 여전히 작동하는지 확인
- [ ] 키워드가 없는 수업은 강사 색상으로 표시되는지 확인
- [ ] 다양한 키워드로 테스트 (예: "PL", "R1", "고1" 등)

**예상 소요 시간**: 3분

---

### 📝 Phase 3: 마무리

#### Step 7: 문서 업데이트
- [ ] 현재 문서의 상태를 "✅ 해결됨"으로 변경
- [ ] 변경 이력 섹션에 구현 완료 기록
- [ ] 커밋 메시지 작성: "Fix: 통합뷰 키워드 색상 미적용 버그 수정"

**예상 소요 시간**: 2분

---

## ⏱️ 예상 총 소요 시간

| Phase | 작업 내용 | 예상 시간 | 체크 |
|-------|----------|----------|------|
| Phase 1 | Step 1: Props 타입 정의 수정 | 2분 | ⬜ |
| Phase 1 | Step 2: 키워드 매칭 로직 구현 | 5분 | ⬜ |
| Phase 1 | Step 3: 렌더링 로직 변경 | 6분 | ⬜ |
| Phase 1 | Step 4: 부모 컴포넌트 Props 전달 | 2분 | ⬜ |
| Phase 2 | Step 5: 기능 테스트 | 5분 | ⬜ |
| Phase 2 | Step 6: 회귀 테스트 | 3분 | ⬜ |
| Phase 3 | Step 7: 문서 업데이트 | 2분 | ⬜ |
| **총계** | | **25분** | - |

---

## 🧪 검증 방법

### 테스트 환경 설정
```bash
# 개발 서버 실행
npm start

# 브라우저에서 localhost:3000 접속
```

### 테스트 시나리오 1: 키워드 색상 적용 확인
1. **설정 화면 이동**
   - 좌측 사이드바 > "설정" 클릭
   - "수업 관리" 탭 선택

2. **키워드 색상 설정**
   - "PL" 키워드 추가
   - 배경색: `#FF0000` (빨강)
   - 글자색: `#FFFFFF` (흰색)
   - "저장" 클릭

3. **시간표 화면 이동**
   - 좌측 사이드바 > "시간표" 클릭
   - 영어반 모드 선택

4. **통합뷰 확인**
   - "통합뷰" 탭 선택
   - "PL"이 포함된 수업 찾기 (예: "PL초2", "PL중1")
   - 빨간 배경에 흰 글씨로 표시되는지 확인

5. **예상 결과**
   ```
   ✅ 수업명이 표시됨 (예: "PL초2")
   ✅ 빨간 배경 (#FF0000)
   ✅ 흰색 글씨 (#FFFFFF)
   ✅ 강사명이 작은 글씨로 아래에 표시됨 (예: "(김선생)")
   ✅ 마우스 오버 시 툴팁에 전체 정보 표시
   ```

---

### 테스트 시나리오 2: 키워드가 없는 수업 확인
1. **키워드 미포함 수업 찾기**
   - 통합뷰에서 "PL"이 없는 수업 확인 (예: "고1수학", "중2영어")

2. **예상 결과**
   ```
   ✅ 수업명이 표시됨
   ✅ 강사 색상으로 표시됨 (키워드 색상 아님)
   ✅ 강사명이 작은 글씨로 아래에 표시됨
   ```

---

### 테스트 시나리오 3: 다른 뷰 회귀 테스트
1. **선생님뷰 확인**
   - "선생님뷰" 탭 선택
   - 키워드 색상이 여전히 작동하는지 확인

2. **강의실뷰 확인**
   - "강의실뷰" 탭 선택
   - 키워드 색상이 여전히 작동하는지 확인

3. **예상 결과**
   ```
   ✅ 선생님뷰: 키워드 색상 정상 작동
   ✅ 강의실뷰: 키워드 색상 정상 작동
   ✅ 통합뷰: 키워드 색상 정상 작동 (수정 완료)
   ```

---

### 테스트 시나리오 4: 엣지 케이스 테스트
1. **여러 키워드가 매칭되는 경우**
   - "PL고1" 수업 (PL + 고1 모두 키워드인 경우)
   - 첫 번째 매칭된 키워드 색상이 적용되는지 확인

2. **키워드가 수업명 중간에 있는 경우**
   - "초등PL2반" (PL이 중간에 있음)
   - `includes()` 메서드로 인해 정상 매칭되는지 확인

3. **빈 수업 (셀이 비어있는 경우)**
   - "-" 표시가 정상적으로 나타나는지 확인

---

## 📄 파일 변경 요약

### 파일 1: `EnglishClassTab.tsx`

#### 변경 위치 1: MiniGridRow Props 정의 (라인 ~651)

**변경 전:**
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className }) => {
```

**변경 후:**
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string,
    classKeywords: ClassKeywordColor[]  // ← 추가
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className, classKeywords }) => {
```

---

#### 변경 위치 2: 렌더링 로직 (라인 ~660-666)

**변경 전:**
```tsx
return (
    <div key={day} className="..." style={style}>
        {cell ? (
            <span className="leading-tight line-clamp-2 break-all">
                {cell.teacher}
            </span>
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

**변경 후:**
```tsx
// 키워드 매칭
const matchedKw = classKeywords.find(kw => className?.includes(kw.keyword));

// teacher 색상 스타일
let teacherStyle = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    teacherStyle = {
        backgroundColor: colors.bg,
        color: colors.text,
        fontWeight: 800
    };
}

// 키워드 색상 스타일 (우선순위: 키워드 > teacher)
const finalStyle = matchedKw ? {
    backgroundColor: matchedKw.bgColor,
    color: matchedKw.textColor,
    fontWeight: 800,
    borderRadius: '4px',
    padding: '2px 4px'
} : teacherStyle;

return (
    <div
        key={day}
        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
        style={finalStyle}
        title={`${className || ''} ${cell?.teacher ? `(${cell.teacher})` : ''}`}
    >
        {cell ? (
            <div className="leading-tight line-clamp-2 break-all flex flex-col gap-0.5">
                {/* 수업명 표시 (키워드 색상 적용) */}
                {className && (
                    <span className="font-bold">
                        {className}
                    </span>
                )}
                {/* 강사명 표시 (작게) */}
                {cell.teacher && (
                    <span className="text-[8px] opacity-70">
                        {cell.teacher}
                    </span>
                )}
            </div>
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

---

#### 변경 위치 3: 부모 컴포넌트에서 Props 전달 (라인 ~549-558)

**변경 전:**
```tsx
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        className={classInfo.name}
    />
))}
```

**변경 후:**
```tsx
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        className={classInfo.name}
        classKeywords={classKeywords}  // ← 추가
    />
))}
```

---

## 🎯 예상 결과

### 수정 전
```
[통합뷰]
월  화  수  목  금
김   박  이  최  정  ← 강사 이름만 표시
```

### 수정 후
```
[통합뷰]
월      화       수       목       금
PL초2   고1수학   PL중2    고2영어   중1수학  ← 수업명 (키워드 색상 적용)
(김)    (박)     (이)     (최)     (정)    ← 강사명 (작게)

[PL초2, PL중2는 빨간 배경에 흰 글씨로 표시됨]
```

---

## 🔧 구현 시 주의사항

### 1. Import 확인
```tsx
// 파일 상단에서 ClassKeywordColor 타입이 import 되어 있는지 확인
import type { ClassKeywordColor } from '@/types';
```

### 2. getTeacherColor 함수 사용
- 이 함수는 이미 `EnglishClassTab.tsx`에 존재하는 함수
- 강사명을 받아서 `{ bg: string, text: string }` 반환
- 위치를 확인하고 동일 파일 내에서 호출

### 3. 우선순위 로직
- **키워드 색상**이 **강사 색상**보다 우선
- `matchedKw`가 존재하면 강사 색상 무시
- 이는 사용자가 의도적으로 설정한 색상이므로 우선순위가 높음

### 4. 성능 고려
- `classKeywords.find()`는 O(n) 연산이지만 키워드 개수가 적으므로 문제 없음
- 보통 키워드는 5-10개 이내
- 필요시 나중에 Map으로 최적화 가능

### 5. 반응형 대응
- `text-[10px]`, `text-[8px]` 사용하여 작은 셀에서도 가독성 유지
- `line-clamp-2`로 2줄 넘어가면 자동 생략
- `title` 속성으로 마우스 오버 시 전체 정보 표시

---

## 🛠️ 수정 방안 (참고용)

### Phase 1: MiniGridRow 컴포넌트 수정 (15분)

#### 1-1. Props에 classKeywords 추가

**수정 전:**
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className }) => {
```

**수정 후:**
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string,
    classKeywords: ClassKeywordColor[]  // ← 추가
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className, classKeywords }) => {
```

#### 1-2. 렌더링 로직 수정

**수정 전 (EnglishClassTab.tsx:651-666):**
```tsx
return (
    <div key={day} className="..." style={style}>
        {cell ? (
            <span className="leading-tight line-clamp-2 break-all">
                {cell.teacher}
            </span>
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

**수정 후:**
```tsx
// 키워드 매칭
const matchedKw = classKeywords.find(kw => className?.includes(kw.keyword));

// teacher 색상 스타일
let teacherStyle = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    teacherStyle = {
        backgroundColor: colors.bg,
        color: colors.text,
        fontWeight: 800
    };
}

// 키워드 색상 스타일 (우선순위: 키워드 > teacher)
const finalStyle = matchedKw ? {
    backgroundColor: matchedKw.bgColor,
    color: matchedKw.textColor,
    fontWeight: 800
} : teacherStyle;

return (
    <div
        key={day}
        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
        style={finalStyle}
        title={`${className || ''} ${cell?.teacher ? `(${cell.teacher})` : ''}`}
    >
        {cell ? (
            <div className="leading-tight line-clamp-2 break-all flex flex-col gap-0.5">
                {/* 수업명 표시 (키워드 색상 적용) */}
                {className && (
                    <span className="font-bold">
                        {className}
                    </span>
                )}
                {/* 강사명 표시 (작게) */}
                {cell.teacher && (
                    <span className="text-[8px] opacity-70">
                        {cell.teacher}
                    </span>
                )}
            </div>
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

#### 1-3. 부모 컴포넌트에서 classKeywords 전달

**수정 전 (EnglishClassTab.tsx:549-558):**
```tsx
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        className={classInfo.name}
    />
))}
```

**수정 후:**
```tsx
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        className={classInfo.name}
        classKeywords={classKeywords}  // ← 추가
    />
))}
```

---

## 📊 버그 발생 이유 추정

### 왜 통합뷰만 빠졌을까?

**가능한 시나리오:**

1. **개발 순서 문제**
   - 선생님뷰, 강의실뷰 먼저 개발
   - 키워드 색상 기능 추가
   - 통합뷰는 나중에 추가되었지만 키워드 색상 로직을 누락

2. **UI 구조 차이**
   - 선생님뷰/강의실뷰: `cellData.className`을 직접 렌더링
   - 통합뷰: `className`을 props로 받지만 **`cell.teacher`만 렌더링**
   - 통합뷰의 원래 목적이 "강사 배치 확인"이었을 가능성

3. **코드 복사 누락**
   - 선생님뷰의 키워드 로직을 통합뷰로 이식하지 않음

---

## 📝 추가 개선 사항

### 선택사항 (우선순위 낮음)

1. **툴팁 개선**
   - 현재: `title={cell?.teacher || ''}`
   - 개선: `title={수업명 + 강사명 + 강의실 정보}`

2. **모바일 최적화**
   - 작은 화면에서 수업명이 너무 길면 잘림
   - `line-clamp-1`로 조정 필요

3. **색상 우선순위 설정 추가**
   - 사용자가 "키워드 색상" vs "강사 색상" 우선순위 선택 가능하게

---

## 🔗 관련 파일

| 파일 | 경로 | 역할 |
|------|------|------|
| EnglishClassTab.tsx | `/ijw-Calander/components/Timetable/English/EnglishClassTab.tsx` | **수정 필요** (버그 있음) |
| EnglishTeacherTab.tsx | `/ijw-Calander/components/Timetable/English/EnglishTeacherTab.tsx` | 참고용 (정상 작동) |
| EnglishRoomTab.tsx | `/ijw-Calander/components/Timetable/English/EnglishRoomTab.tsx` | 참고용 (정상 작동) |
| types.ts | `/ijw-Calander/types.ts` | `ClassKeywordColor` 타입 정의 |

---

## 📌 다음 단계

1. **즉시 수정 권장** - 사용자가 설정한 기능이 작동하지 않는 것은 신뢰도 문제
2. **수정 후 테스트** - 모든 뷰에서 키워드 색상이 정상 작동하는지 확인
3. **keyword-color-report.md 업데이트** - 상태를 "해결됨"으로 변경

---

## 📅 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|-----------|--------|
| 2025-12-30 | 초기 버그 리포트 작성 및 근본 원인 분석 | Claude |
| 2025-12-30 | 수정 방안 제시 및 코드 예시 추가 | Claude |
| 2025-12-31 | 구현 체크리스트, 검증 방법, 파일 변경 요약 추가 - 구현 준비 완료 | Claude |

---

*Last Updated: 2025-12-31*
*Bug Status: 🟡 Partial Fix (1/3 tabs working)*
*Estimated Fix Time: ~25 minutes*
*Implementation Ready: ✅ YES*
