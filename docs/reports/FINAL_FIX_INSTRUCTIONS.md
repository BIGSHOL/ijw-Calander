# 🚨 키워드 색상 버그 - 최종 수정 지침서

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
**수정 위치**: 3곳
**예상 소요 시간**: 3분
**현재 상태**: ❌ **미구현** (0/3 완료)
**우선순위**: 🔴 **High** (통합뷰 키워드 색상 완전히 미작동)

---

## 📊 구현 상태 (2025-12-31 검증)

| 수정 항목 | 위치 | 상태 | 비고 |
|----------|------|------|------|
| MiniGridRow Props | Line 1102-1108 | ❌ 미구현 | `classKeywords` 파라미터 없음 |
| Props 전달 | Line 989-999 | ❌ 미구현 | `classKeywords={classKeywords}` 누락 |
| 렌더링 로직 | Line 1143-1175 | ❌ 미구현 | 키워드 매칭 로직 없음, teacher만 표시 |

**검증 방법**: code-reviewer 에이전트로 실제 코드 확인 완료

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

## 🔍 현재 코드 상태 (실제 확인 결과)

### 실제 Line 1102-1108 (MiniGridRow Props)
```typescript
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[]
    // ❌ className 파라미터 없음
    // ❌ classKeywords 파라미터 없음
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays }) => {
```

### 실제 Line 989-999 (Props 전달)
```typescript
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        // ❌ className 누락
        // ❌ classKeywords 누락
    />
))}
```

### 실제 Line 1143-1175 (렌더링 로직)
```typescript
const cell = scheduleMap[effectivePeriodId]?.[day];

// Get style based on teacher
let teacherStyle = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    // ❌ 키워드 매칭 로직 없음
    teacherStyle = { backgroundColor: colors.bg, color: colors.text, fontWeight: 600 };
}

return (
    <div style={teacherStyle} title={cell?.teacher || ''}>
        {cell ? (
            <span>{cell.teacher}</span>  // ❌ teacher만 표시, className 없음
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

---

## 📋 구현 체크리스트

### Phase 1: Props 정의 (2분)
- [ ] Line 1102: `className: string` 파라미터 추가
- [ ] Line 1102: `classKeywords: ClassKeywordColor[]` 파라미터 추가
- [ ] Line 1108: destructuring에 `className, classKeywords` 추가

### Phase 2: Props 전달 (30초)
- [ ] Line 996: `className={classInfo.name}` 추가
- [ ] Line 997: `classKeywords={classKeywords}` 추가

### Phase 3: 렌더링 로직 구현 (1분)
- [ ] Line 1145: `const matchedKw = classKeywords.find(...)` 추가
- [ ] Line 1151: `const finalStyle = matchedKw ? {...} : teacherStyle` 추가
- [ ] Line 1160: title 속성에 className 포함
- [ ] Line 1164-1173: div 구조로 변경, className과 teacher 모두 표시

### Phase 4: 테스트 (2분)
- [ ] 빌드 오류 없이 컴파일 성공
- [ ] 통합뷰에서 className 표시 확인
- [ ] 키워드 색상 적용 확인
- [ ] teacher 이름도 함께 표시 확인

---

## 🚀 다음 단계

1. **즉시 구현 가능**: 위 3개 수정사항은 모두 독립적이며 안전함
2. **예상 소요 시간**: 총 3-5분
3. **영향 범위**: EnglishClassTab 통합뷰만 영향
4. **롤백**: 간단 (파일 되돌리기만 하면 됨)

---

*Created: 2025-12-30*
*Updated: 2025-12-31 (코드 검증 완료)*
*Instructions: 위 3개 수정만 완료하면 즉시 작동*
