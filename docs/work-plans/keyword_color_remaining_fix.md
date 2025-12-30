# 🔧 키워드 색상 버그 - 남은 수정사항

**작성일**: 2025-12-30
**상태**: 🟡 **부분 완료** (30% 완료)
**우선순위**: 🔴 **긴급** - 기능이 여전히 작동 안 함

---

## ✅ 이미 완료된 수정사항

| 항목 | 상태 | 위치 |
|------|------|------|
| ClassKeywordColor import | ✅ 완료 | Line 7 |
| EnglishClassTabProps에 classKeywords 추가 | ✅ 완료 | Line 27 |
| 컴포넌트 props에서 classKeywords 받기 | ✅ 완료 | Line 46-50 |

---

## ❌ 아직 완료되지 않은 수정사항

### 1. MiniGridRow에 classKeywords props 추가 (필수)

**위치**: `EnglishClassTab.tsx:595-602`

**현재 코드**:
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

**수정해야 할 코드**:
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
                                                                                   // ↑ 추가
```

---

### 2. 부모 컴포넌트에서 MiniGridRow에 classKeywords 전달 (필수)

**위치**: `EnglishClassTab.tsx:549-557`

**현재 코드**:
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

**수정해야 할 코드**:
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

### 3. MiniGridRow 렌더링 로직 수정 (핵심!)

**위치**: `EnglishClassTab.tsx:642-666`

#### 3-1. 키워드 매칭 로직 추가

**현재 코드 (642-649번 줄)**:
```tsx
// Note: scheduleMap structure is Map[periodId][day] -> Cell
// So we just access correct period key
const cell = scheduleMap[effectivePeriodId]?.[day];

// Get style based on teacher
let style = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    style = { backgroundColor: colors.bg, color: colors.text, fontWeight: 800 };
}
```

**수정해야 할 코드**:
```tsx
// Note: scheduleMap structure is Map[periodId][day] -> Cell
// So we just access correct period key
const cell = scheduleMap[effectivePeriodId]?.[day];

// 키워드 매칭 (className 기준)
const matchedKw = classKeywords.find(kw => className?.includes(kw.keyword));

// Get style based on teacher
let teacherStyle = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    teacherStyle = { backgroundColor: colors.bg, color: colors.text, fontWeight: 800 };
}

// 최종 스타일: 키워드 우선, 없으면 teacher 스타일
const finalStyle = matchedKw ? {
    backgroundColor: matchedKw.bgColor,
    color: matchedKw.textColor,
    fontWeight: 800
} : teacherStyle;
```

#### 3-2. 렌더링 부분 수정 (수업명 표시)

**현재 코드 (651-666번 줄)**:
```tsx
return (
    <div
        key={day}
        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
        style={style}
        title={cell?.teacher || ''}
    >
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

**수정해야 할 코드**:
```tsx
return (
    <div
        key={day}
        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
        style={finalStyle}  // ← style을 finalStyle로 변경
        title={`${className || ''} ${cell?.teacher ? `(${cell.teacher})` : ''}`}  // ← title 개선
    >
        {cell ? (
            <div className="leading-tight line-clamp-2 break-all flex flex-col gap-0.5">
                {/* 수업명 표시 (키워드 색상 적용) */}
                {className && (
                    <span className="font-bold text-[10px]">
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

## 📝 수정 요약

### 변경 파일
- `components/Timetable/English/EnglishClassTab.tsx` (1개 파일만)

### 변경 위치 (3곳)
1. **Line 595-602**: MiniGridRow props에 `classKeywords` 추가
2. **Line 549-557**: MiniGridRow 호출 시 `classKeywords={classKeywords}` 전달
3. **Line 642-666**: 키워드 매칭 로직 + 렌더링 로직 수정

### 예상 소요 시간
- **5분** (3곳만 수정하면 됨)

---

## 🧪 테스트 방법

수정 후 다음 단계로 테스트:

```bash
# 1. 개발 서버 실행
npm start

# 2. 브라우저에서:
# - 설정 > 수업 관리
# - "PL" 키워드에 빨간색 배경/흰색 글자 설정
# - 시간표 모드로 전환
# - 통합뷰 탭 선택
# - "PL"이 포함된 수업이 빨간색으로 표시되는지 확인
```

### 기대 결과

**수정 전**:
```
월      화      수      목      금
김선생   박선생   이선생   최선생   정선생  ← 강사명만 표시, 강사 색상
```

**수정 후**:
```
월        화         수         목         금
PL초2     고1수학     PL중2      고2영어     중1수학  ← 수업명 (키워드 색상)
(김선생)  (박선생)   (이선생)   (최선생)   (정선생)  ← 강사명 (작게)
```

---

## 🐛 왜 여전히 안 되는가?

### 현재 상황
- ✅ EnglishClassTab이 `classKeywords`를 **props로 받음**
- ❌ MiniGridRow에 **전달하지 않음**
- ❌ MiniGridRow에서 **사용하지 않음**
- ❌ 여전히 `cell.teacher`만 렌더링

### 데이터 흐름
```
[App.tsx]
    ↓ classKeywords
[TimetableManager]
    ↓ classKeywords
[EnglishTimetable]
    ↓ classKeywords
[EnglishClassTab] ✅ classKeywords를 props로 받음
    ↓ ❌ MiniGridRow에 전달 안 함!
[MiniGridRow] ❌ classKeywords 없음!
    ↓
❌ 키워드 색상 적용 불가
```

---

## 📌 다음 단계

아래 3개 수정사항만 완료하면 즉시 작동합니다:

### 체크리스트
- [ ] **Step 1**: MiniGridRow props에 `classKeywords: ClassKeywordColor[]` 추가
- [ ] **Step 2**: 부모에서 `classKeywords={classKeywords}` 전달
- [ ] **Step 3**: 렌더링 로직 수정 (키워드 매칭 + 수업명 표시)

---

## 💡 참고: 정상 작동하는 코드 (EnglishTeacherTab)

`EnglishTeacherTab.tsx:707-718`에서 동일한 로직이 이미 정상 작동 중:

```tsx
const matchedKw = classKeywords.find(kw => cellData.className?.includes(kw.keyword));
return (
    <div
        className="..."
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
```

---

*Last Updated: 2025-12-30*
*Status: 부분 완료 - 3개 수정사항 남음*
*Estimated Completion Time: 5 minutes*
