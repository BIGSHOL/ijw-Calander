# 🚨 키워드 색상 버그 - 최종 수정 지침서

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
**수정 위치**: 3곳
**예상 소요 시간**: 3분

---

## ✏️ 수정 1: MiniGridRow Props 추가 (Line 595-602)

### 현재 코드:
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

### 수정 후:
```tsx
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    className: string,
    classKeywords: ClassKeywordColor[]  // ← 이 줄 추가
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className, classKeywords }) => {
                                                                      // ↑ classKeywords 추가
```

---

## ✏️ 수정 2: 부모에서 classKeywords 전달 (Line 549-557)

### 현재 코드:
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

### 수정 후:
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
        classKeywords={classKeywords}  // ← 이 줄 추가
    />
))}
```

---

## ✏️ 수정 3: 렌더링 로직 전체 교체 (Line 640-666)

### 현재 코드 전체:
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

### 수정 후 전체:
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

## 📝 변경사항 요약

### 수정 1 (Line 601-602)
- `className: string` 다음 줄에 `classKeywords: ClassKeywordColor[]` 추가
- destructuring 파라미터에 `, classKeywords` 추가

### 수정 2 (Line 556)
- `className={classInfo.name}` 다음 줄에 `classKeywords={classKeywords}` 추가

### 수정 3 (Line 640-666)
**변경 전 → 변경 후**:
- `let style = {}` → `let teacherStyle = {}`
- `style = { ... }` → `teacherStyle = { ... }`
- 추가: `const matchedKw = classKeywords.find(...)`
- 추가: `const finalStyle = matchedKw ? { ... } : teacherStyle`
- `style={style}` → `style={finalStyle}`
- `title={cell?.teacher || ''}` → ``title={`${className || ''} ${cell?.teacher ? `(${cell.teacher})` : ''}`}``
- `<span>...</span>` → `<div className="..."><span>...</span><span>...</span></div>`

---

## 🎯 예상 결과

### 수정 전:
```
통합뷰
──────────────────
월      화      수
김선생   박선생   이선생  ← 강사명만, 강사 색상
```

### 수정 후:
```
통합뷰
──────────────────
월         화          수
PL초2      고1수학      PL중2     ← 수업명 (키워드 색상!)
(김선생)   (박선생)    (이선생)   ← 강사명
```

---

## ✅ 테스트 방법

1. 파일 저장
2. `npm start`
3. 설정 > 수업 관리 > "PL" 키워드에 빨간색/흰색 설정
4. 시간표 > 통합뷰 확인
5. "PL" 포함 수업이 빨간 배경에 흰 글씨로 표시되는지 확인

---

*Created: 2025-12-30*
*Instructions: 위 3개 수정만 완료하면 즉시 작동*
