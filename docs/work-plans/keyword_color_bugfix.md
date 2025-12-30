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

## 🛠️ 수정 방안

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

## ⏱️ 예상 작업 시간

| 작업 | 시간 | 체크 |
|------|------|------|
| MiniGridRow props에 classKeywords 추가 | 2분 | ⬜ |
| 렌더링 로직 수정 (키워드 매칭 + 스타일 적용) | 8분 | ⬜ |
| 부모 컴포넌트에서 전달 | 2분 | ⬜ |
| 테스트 및 검증 | 5분 | ⬜ |
| **총 예상 시간** | **17분** | - |

---

## 🧪 테스트 방법

### 테스트 케이스
1. ✅ 설정 > 수업 관리에서 "PL" 키워드에 빨간색/흰색 설정
2. ✅ 시간표 > 통합뷰로 이동
3. ✅ "PL"이 포함된 수업이 빨간 배경에 흰 글씨로 표시되는지 확인
4. ✅ 키워드가 없는 수업은 기존대로 강사 색상으로 표시되는지 확인
5. ✅ 수업명과 강사명이 모두 표시되는지 확인

### 검증 명령
```bash
# 개발 서버 실행
npm start

# 테스트 순서:
# 1. 설정 > 수업 관리 > "PL" 키워드 색상 설정 (예: 빨강 배경, 흰색 글자)
# 2. 시간표 모드로 전환
# 3. 통합뷰 탭 선택
# 4. "PL"이 포함된 수업 확인
# 5. 색상이 적용되었는지 확인
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
```

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

---

*Last Updated: 2025-12-30*
*Bug Status: 🟡 Partial Fix (1/3 tabs working)*
*Estimated Fix Time: ~17 minutes*
