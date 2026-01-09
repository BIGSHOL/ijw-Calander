# 간트 차트 화살표 수정 및 고급 UI 개선 계획

**작성일**: 2026-01-03
**상태**: ✅ Phase 1 & 2 완료
**우선순위**: Phase 1 (긴급) → Phase 2 (단기) → Phase 3 (장기)

---

## 📋 목차

1. [현재 문제 분석](#-현재-문제-분석)
2. [Phase 1: 화살표 버그 수정 (긴급)](#-phase-1-화살표-버그-수정-긴급)
3. [Phase 2: 2번 사진 스타일 구현 (단기)](#-phase-2-2번-사진-스타일-구현-단기)
4. [Phase 3: 고급 기능 추가 (장기)](#-phase-3-고급-기능-추가-장기)
5. [구현 로드맵](#-구현-로드맵)

---

## 🔴 현재 문제 분석

### 문제 1: 의존성 화살표 위치 불일치

#### 증상
![현재 상태](사용자 제공 1번 사진)
- 화살표가 작업 바의 중앙이 아닌 엉뚱한 위치에 그려짐
- Task Works → Debug Task 화살표가 잘못된 Y 좌표
- Debug Task → Persistence Task 화살표 위치 오류
- Persistence Task → 111 화살표 위치 오류

#### 근본 원인

**1. CSS 마진 계산 오류**

현재 코드 (GanttChart.tsx:86-113):
```typescript
// Timeline header height
const timelineHeaderHeight = 74;
let cumulativeY = timelineHeaderHeight;

groups.forEach((group, groupIndex) => {
    // ❌ 문제: 첫 그룹에 마진 안 줌
    if (groupIndex > 0) {
        cumulativeY += 32; // mt-8
    }

    const groupHeaderHeight = 40;
    cumulativeY += groupHeaderHeight;

    // ...
});
```

실제 렌더링 (GanttChart.tsx:327):
```tsx
{groups.map((group, gIndex) => (
    <div key={group.id} className="mt-8">  {/* ✅ 모든 그룹에 mt-8! */}
        {/* Group Header */}
        <div className="flex items-center gap-2 mb-4 sticky left-0 px-2">
```

**결과**: 첫 그룹부터 32px 오차 발생 → 누적되어 화살표 위치 완전히 틀어짐

**2. paddingLeft/Right 미반영**

```typescript
<div
    className="min-w-fit relative pb-20"
    style={{ width: chartWidth, paddingLeft: 40, paddingRight: 40 }}
>
```

X 좌표 계산에 `paddingLeft: 40px` 반영 안 됨

**3. SVG 좌표계 vs DOM 좌표계 불일치**

SVG는 `absolute inset-0`으로 부모 컨테이너 전체를 덮지만, 실제 작업 바들은:
- paddingLeft: 40px 안쪽에 위치
- Timeline header 아래에 위치

---

### 문제 2: 현재 UI vs 목표 UI 차이

#### 현재 UI (1번 사진)
```
❌ 단순한 직사각형 바
❌ 단조로운 색상
❌ 화살표만 있음 (연결선 없음)
❌ 그룹 구분이 약함
❌ 날짜 헤더가 단순함
```

#### 목표 UI (2번 사진 - 참고 디자인)
```
✅ 둥근 모서리 Pill 스타일 바
✅ 생생한 네온 그라데이션
✅ 부드러운 곡선 화살표 (베지어 커브)
✅ 카테고리별 명확한 구분
✅ 월/일자 헤더 구분
✅ 호버 시 입체감
✅ 그림자 효과
```

---

## 🔧 Phase 1: 화살표 버그 수정 (긴급)

**목표**: 의존성 화살표가 정확한 위치에 렌더링되도록 수정
**소요 시간**: 1-2시간
**우선순위**: 🔴 최우선

### Step 1.1: Y 좌표 계산 수정

**파일**: `components/Gantt/GanttChart.tsx`

**Before** (Line 86-113):
```typescript
const taskPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; endX: number }> = {};

    const timelineHeaderHeight = 74;
    let cumulativeY = timelineHeaderHeight;

    groups.forEach((group, groupIndex) => {
        // ❌ 문제: 첫 그룹 마진 누락
        if (groupIndex > 0) {
            cumulativeY += 32; // mt-8
        }

        const groupHeaderHeight = 40;
        cumulativeY += groupHeaderHeight;

        group.tasks.forEach(task => {
            const startX = task.startOffset * dayWidth;
            const endX = (task.startOffset + task.duration) * dayWidth;
            const y = cumulativeY + rowHeight / 2;
            positions[task.id] = { x: startX, y, endX };
            cumulativeY += rowHeight;
        });
    });

    return positions;
}, [groups, dayWidth, rowHeight]);
```

**After** (수정안):
```typescript
const taskPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; endX: number }> = {};

    // Timeline header: pt-4(16) + height(50) + pb-2(8) = 74px
    const timelineHeaderHeight = 74;

    // Padding left offset
    const paddingLeft = 40;

    let cumulativeY = timelineHeaderHeight;

    groups.forEach((group, groupIndex) => {
        // ✅ 모든 그룹에 mt-8 적용 (실제 렌더링과 일치)
        cumulativeY += 32; // mt-8 for all groups

        // Group header:
        // - CheckCircle2 (16px) + gap-2 (8px) + text (~16px) = ~40px
        // - mb-4 (16px)
        const groupHeaderHeight = 40 + 16; // header + margin-bottom
        cumulativeY += groupHeaderHeight;

        group.tasks.forEach(task => {
            // ✅ paddingLeft 오프셋 추가
            const startX = paddingLeft + (task.startOffset * dayWidth);
            const endX = paddingLeft + ((task.startOffset + task.duration) * dayWidth);

            // Task row center: h-[60px] → center at 30px
            const y = cumulativeY + (rowHeight / 2);

            positions[task.id] = { x: startX, y, endX };

            // Move to next task row
            cumulativeY += rowHeight; // 60px
        });
    });

    return positions;
}, [groups, dayWidth, rowHeight]);
```

### Step 1.2: 디버깅 헬퍼 추가 (개발 중)

화살표 위치를 시각적으로 확인하기 위한 디버그 마커:

```typescript
// Development only - Remove in production
const showDebugMarkers = true;

{showDebugMarkers && Object.entries(taskPositions).map(([id, pos]) => (
    <circle
        key={`debug-${id}`}
        cx={pos.x}
        cy={pos.y}
        r="4"
        fill="red"
        opacity="0.8"
    />
))}
```

### Step 1.3: 검증 체크리스트

- [ ] Task Works의 끝 좌표 = Debug Task 화살표 시작점
- [ ] Debug Task의 끝 좌표 = Persistence Task 화살표 시작점
- [ ] 모든 화살표가 작업 바 중앙 (세로)에 위치
- [ ] 화살표가 작업 바의 왼쪽/오른쪽 끝에서 시작/끝
- [ ] 줌 인/아웃 시에도 위치 유지

---

## 🎨 Phase 2: 2번 사진 스타일 구현 (단기)

**목표**: 참고 디자인과 같은 고급스러운 UI 구현
**소요 시간**: 1-2일
**우선순위**: 🟡 높음

### 2.1 목표 디자인 분석 (2번 사진 기준)

#### 시각적 요소

1. **작업 바 스타일**
   - 둥근 Pill 형태 (`rounded-full`)
   - 생생한 색상 (네온 블루, 오렌지, 핑크, 그린)
   - 부드러운 그림자 (`shadow-lg shadow-[color]/50`)
   - 호버 시 약간 확대 (`hover:scale-105`)

2. **화살표 스타일**
   - 부드러운 베지어 곡선 (Cubic Bezier)
   - 밝은 네온 컬러
   - Glow 효과 (두꺼운 반투명 외곽선)
   - 끝에 화살촉 마커

3. **카테고리 헤더**
   - 원형 체크 아이콘
   - 볼드 텍스트
   - 카테고리 색상 강조

4. **타임라인 헤더**
   - 월/연도 구분
   - 주말 색상 강조
   - 날짜 번호 크게 표시

### 2.2 작업 바 개선

**파일**: `components/Gantt/GanttChart.tsx` (Line 359-380)

**Before**:
```tsx
<div
    className={`absolute h-[42px] rounded-xl flex flex-col justify-center px-4
                ${theme.bg} ${theme.shadow} shadow-lg
                transition-all hover:scale-[1.02] cursor-pointer z-10`}
    style={{
        left: task.startOffset * dayWidth,
        width: Math.max(dayWidth * task.duration, 60)
    }}
>
```

**After**:
```tsx
<div
    className={`absolute h-[36px] rounded-full flex items-center justify-center px-5
                ${theme.bg} shadow-xl ${theme.glow}
                transition-all duration-300 hover:scale-110 hover:-translate-y-1
                cursor-pointer z-10 border border-white/20`}
    style={{
        left: paddingLeft + (task.startOffset * dayWidth),
        width: Math.max(dayWidth * task.duration, 80),
        boxShadow: `0 8px 32px ${theme.shadowColor}, 0 0 0 1px rgba(255,255,255,0.1)`
    }}
>
    <span className="text-[10px] font-bold text-white truncate">
        {task.title}
    </span>
</div>
```

**새로운 색상 팔레트**:
```typescript
const COLORS = [
    {
        bg: 'bg-gradient-to-r from-cyan-500 to-blue-500',
        glow: 'shadow-cyan-500/50',
        shadowColor: 'rgba(6, 182, 212, 0.5)'
    },
    {
        bg: 'bg-gradient-to-r from-orange-500 to-amber-500',
        glow: 'shadow-orange-500/50',
        shadowColor: 'rgba(249, 115, 22, 0.5)'
    },
    {
        bg: 'bg-gradient-to-r from-pink-500 to-rose-500',
        glow: 'shadow-pink-500/50',
        shadowColor: 'rgba(236, 72, 153, 0.5)'
    },
    {
        bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
        glow: 'shadow-emerald-500/50',
        shadowColor: 'rgba(16, 185, 129, 0.5)'
    },
    {
        bg: 'bg-gradient-to-r from-violet-500 to-purple-500',
        glow: 'shadow-violet-500/50',
        shadowColor: 'rgba(139, 92, 246, 0.5)'
    },
    {
        bg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
        glow: 'shadow-blue-600/50',
        shadowColor: 'rgba(59, 130, 246, 0.5)'
    },
];
```

### 2.3 베지어 곡선 화살표

**Before** (직각 경로):
```typescript
if (endX > startX) {
    const midX = startX + (endX - startX) / 2;
    path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
} else {
    const offset = 15;
    path = `M ${startX} ${startY} L ${startX + offset} ${startY} L ${startX + offset} ${endY} L ${endX} ${endY}`;
}
```

**After** (부드러운 곡선):
```typescript
if (endX > startX) {
    // Forward dependency: smooth cubic bezier
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Control points for smooth curve
    const cp1x = startX + deltaX * 0.5;
    const cp1y = startY;
    const cp2x = startX + deltaX * 0.5;
    const cp2y = endY;

    path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
} else {
    // Backward dependency: loop around
    const loopHeight = 30;
    const cp1x = startX + 20;
    const cp1y = startY;
    const cp2x = startX + 20;
    const cp2y = startY + loopHeight;
    const cp3x = endX - 20;
    const cp3y = endY + loopHeight;
    const cp4x = endX - 20;
    const cp4y = endY;

    path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${(startX + endX) / 2} ${startY + loopHeight}
            C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${endX} ${endY}`;
}
```

### 2.4 Glow 효과 강화

```tsx
{dependencyArrows.map((arrow, idx) => (
    <g key={`arrow-${idx}`}>
        {/* Outer glow */}
        <path
            d={arrow.path}
            fill="none"
            stroke={arrow.color}
            strokeWidth="12"
            opacity="0.15"
            strokeLinecap="round"
            filter="blur(4px)"
        />
        {/* Middle glow */}
        <path
            d={arrow.path}
            fill="none"
            stroke={arrow.color}
            strokeWidth="6"
            opacity="0.3"
            strokeLinecap="round"
        />
        {/* Main line */}
        <path
            d={arrow.path}
            fill="none"
            stroke={arrow.color}
            strokeWidth="2.5"
            markerEnd={`url(#arrowhead-${idx})`}
            opacity="1"
            strokeLinecap="round"
        />
    </g>
))}
```

### 2.5 타임라인 헤더 개선

**월 구분선 추가**:
```tsx
{Array.from({ length: maxDay + 2 }).map((_, i) => {
    const date = addDays(baseDate, i);
    const showMonth = i === 0 || format(date, 'M') !== format(addDays(baseDate, i - 1), 'M');

    return (
        <div key={i} className="relative" style={{ width: dayWidth }}>
            {/* Month divider */}
            {showMonth && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/50 to-transparent" />
            )}

            {/* Date content */}
            <div className={`flex flex-col items-center justify-end h-[50px] ${isWeekend ? 'bg-red-500/5' : ''}`}>
                {showMonth && (
                    <span className="text-sm font-bold text-emerald-400 mb-1">
                        {format(date, 'MMM', { locale: ko })}
                    </span>
                )}
                <span className={`text-lg font-bold ${isWeekend ? 'text-red-400' : 'text-slate-200'}`}>
                    {format(date, 'd')}
                </span>
                <span className="text-[9px] text-slate-500">
                    {format(date, 'EEE', { locale: ko })}
                </span>
            </div>
        </div>
    );
})}
```

---

## 🚀 Phase 3: 고급 기능 추가 (장기)

**목표**: 사용성 및 인터랙션 개선
**소요 시간**: 3-5일
**우선순위**: 🟢 중간

### 3.1 인터랙티브 기능

#### 3.1.1 작업 바 호버 툴팁

```tsx
const [hoveredTask, setHoveredTask] = useState<string | null>(null);

// Task bar에 추가
onMouseEnter={() => setHoveredTask(task.id)}
onMouseLeave={() => setHoveredTask(null)}

{/* Tooltip */}
{hoveredTask === task.id && (
    <div className="absolute z-50 bg-slate-800 text-white px-3 py-2 rounded-lg shadow-xl border border-white/10"
         style={{
             top: -60,
             left: task.startOffset * dayWidth,
             minWidth: 200
         }}>
        <div className="text-xs font-bold mb-1">{task.title}</div>
        <div className="text-[10px] text-slate-300 space-y-0.5">
            <div>📅 {formatTaskDate(task.startOffset)} - {formatTaskDate(task.startOffset + task.duration)}</div>
            {task.assigneeName && <div>👤 {task.assigneeName}</div>}
            {task.dependsOn && task.dependsOn.length > 0 && (
                <div>🔗 선행작업: {task.dependsOn.length}개</div>
            )}
        </div>
    </div>
)}
```

#### 3.1.2 화살표 하이라이트

```tsx
const [hoveredArrow, setHoveredArrow] = useState<number | null>(null);

<path
    d={arrow.path}
    onMouseEnter={() => setHoveredArrow(idx)}
    onMouseLeave={() => setHoveredArrow(null)}
    className="cursor-pointer"
    strokeWidth={hoveredArrow === idx ? "4" : "2.5"}
    opacity={hoveredArrow === idx ? "1" : "0.8"}
/>
```

#### 3.1.3 드래그 앤 드롭으로 기간 조정

```tsx
const [dragState, setDragState] = useState<{
    taskId: string;
    startX: number;
    originalOffset: number;
} | null>(null);

const handleMouseDown = (e: React.MouseEvent, task: GanttSubTask) => {
    setDragState({
        taskId: task.id,
        startX: e.clientX,
        originalOffset: task.startOffset
    });
};

const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const dayDelta = Math.round(deltaX / dayWidth);
    const newOffset = Math.max(0, dragState.originalOffset + dayDelta);

    // Update task offset
    updateTaskOffset(dragState.taskId, newOffset);
};
```

### 3.2 필터링 & 검색

#### 3.2.1 카테고리 필터

```tsx
const [visibleCategories, setVisibleCategories] = useState<Set<string>>(
    new Set(['planning', 'development', 'testing', 'other'])
);

const toggleCategory = (catId: string) => {
    setVisibleCategories(prev => {
        const next = new Set(prev);
        if (next.has(catId)) {
            next.delete(catId);
        } else {
            next.add(catId);
        }
        return next;
    });
};

// Filter button UI
<div className="flex gap-2">
    {Object.entries(CATEGORY_CONFIG).map(([id, config]) => (
        <button
            key={id}
            onClick={() => toggleCategory(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                visibleCategories.has(id)
                    ? `${config.bgActive} text-white`
                    : 'bg-slate-700 text-slate-400'
            }`}
        >
            {config.title}
        </button>
    ))}
</div>
```

#### 3.2.2 담당자 필터

```tsx
const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

const filteredGroups = useMemo(() => {
    if (!selectedAssignee) return groups;

    return groups.map(group => ({
        ...group,
        tasks: group.tasks.filter(t => t.assigneeId === selectedAssignee)
    })).filter(g => g.tasks.length > 0);
}, [groups, selectedAssignee]);
```

### 3.3 프로그레스 추적

#### 3.3.1 진행률 표시

```tsx
const overallProgress = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
}, [tasks]);

// Progress bar
<div className="h-2 bg-slate-700 rounded-full overflow-hidden">
    <div
        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
        style={{ width: `${overallProgress}%` }}
    />
</div>
```

#### 3.3.2 작업 완료 체크

```tsx
// Task bar에 체크 아이콘 추가
{task.completed && (
    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-900">
        <Check size={12} className="text-white" />
    </div>
)}
```

### 3.4 Export 기능

#### 3.4.1 이미지로 저장

```tsx
import html2canvas from 'html2canvas';

const exportAsImage = async () => {
    const element = containerRef.current;
    if (!element) return;

    const canvas = await html2canvas(element, {
        backgroundColor: '#15171e',
        scale: 2
    });

    const link = document.createElement('a');
    link.download = `gantt-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL();
    link.click();
};
```

#### 3.4.2 PDF 저장

```tsx
import { jsPDF } from 'jspdf';

const exportAsPDF = async () => {
    const element = containerRef.current;
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`gantt-${new Date().toISOString()}.pdf`);
};
```

---

## 📊 구현 로드맵

### Timeline

```
Week 1 (긴급)
├─ Day 1-2: Phase 1 - 화살표 버그 수정
│   ├─ Y 좌표 계산 수정
│   ├─ X 좌표 padding 반영
│   ├─ 디버그 마커 추가
│   └─ 검증 테스트
│
└─ Day 3-7: Phase 2 - UI 개선
    ├─ 작업 바 Pill 스타일
    ├─ 색상 팔레트 업그레이드
    ├─ 베지어 곡선 화살표
    ├─ Glow 효과 강화
    └─ 타임라인 헤더 개선

Week 2-3 (선택)
└─ Phase 3 - 고급 기능
    ├─ 호버 툴팁
    ├─ 드래그 앤 드롭
    ├─ 필터링
    ├─ 진행률 추적
    └─ Export 기능
```

### 우선순위 Matrix

| 우선순위 | 작업 | 소요 시간 | 영향도 |
|---------|------|----------|--------|
| 🔴 P0 | 화살표 Y 좌표 수정 | 1시간 | 매우 높음 (버그) |
| 🔴 P0 | 화살표 X 좌표 수정 | 30분 | 매우 높음 (버그) |
| 🟡 P1 | Pill 스타일 작업 바 | 2시간 | 높음 (시각적) |
| 🟡 P1 | 베지어 곡선 화살표 | 3시간 | 높음 (시각적) |
| 🟡 P1 | 색상 팔레트 개선 | 1시간 | 중간 |
| 🟢 P2 | 호버 툴팁 | 2시간 | 중간 |
| 🟢 P2 | 타임라인 헤더 개선 | 2시간 | 중간 |
| 🟢 P3 | 드래그 앤 드롭 | 4시간 | 낮음 |
| 🟢 P3 | 필터링 | 3시간 | 낮음 |
| 🟢 P3 | Export 기능 | 2시간 | 낮음 |

---

## 🧪 테스트 계획

### Phase 1 검증

**시나리오 1: 단순 선형 의존성**
```
기획 카테고리:
- Task A (D0, 2일)

개발 카테고리:
- Task B (D2, 3일) → 선행: Task A

테스트 카테고리:
- Task C (D5, 2일) → 선행: Task B
```

**기대 결과**:
- Task A 끝(오른쪽) → Task B 시작(왼쪽) 화살표
- Task B 끝(오른쪽) → Task C 시작(왼쪽) 화살표
- 모든 화살표가 작업 바 중앙(세로)을 통과

**시나리오 2: 복잡한 의존성**
```
- Task D (D0, 2일)
- Task E (D1, 3일) → 선행: Task D
- Task F (D2, 2일) → 선행: Task D
- Task G (D4, 3일) → 선행: Task E, Task F
```

**기대 결과**:
- Task D → Task E, Task F (2개 화살표)
- Task E, Task F → Task G (2개 화살표 수렴)
- 화살표 겹치지 않음

**시나리오 3: 역방향 의존성**
```
- Task H (D5, 2일)
- Task I (D2, 2일) → 선행: Task H (미래 작업 의존)
```

**기대 결과**:
- Task H → Task I 화살표가 위로 돌아감
- 부드러운 곡선

### Phase 2 검증

**시각적 체크리스트**:
- [ ] 작업 바가 둥근 Pill 형태
- [ ] 그라데이션 배경 적용
- [ ] 호버 시 확대 및 그림자 강화
- [ ] 화살표가 부드러운 곡선
- [ ] Glow 효과가 자연스러움
- [ ] 월 구분선이 표시됨
- [ ] 주말 배경 강조

---

## 📝 체크리스트

### Phase 1: 화살표 수정

- [ ] `taskPositions` Y 좌표 계산 수정
  - [ ] 모든 그룹에 `mt-8` 적용
  - [ ] Timeline header 높이 반영
  - [ ] Group header + mb-4 높이 반영

- [ ] `taskPositions` X 좌표 계산 수정
  - [ ] `paddingLeft: 40px` 오프셋 추가

- [ ] 디버그 마커 추가 (개발 환경)
  - [ ] 각 작업 바 중앙에 빨간 점 표시
  - [ ] 화살표 시작/끝점 표시

- [ ] 테스트 시나리오 1-3 검증

- [ ] 프로덕션 빌드 및 배포

### Phase 2: UI 개선

- [ ] 작업 바 스타일 변경
  - [ ] `rounded-full` 적용
  - [ ] 그라데이션 배경
  - [ ] 호버 효과 강화

- [ ] 화살표 베지어 곡선
  - [ ] 정방향 곡선 구현
  - [ ] 역방향 루프 구현

- [ ] Glow 효과 3단계
  - [ ] Outer glow (blur)
  - [ ] Middle glow
  - [ ] Main line

- [ ] 타임라인 헤더 개선
  - [ ] 월 구분선
  - [ ] 날짜 크기 증가
  - [ ] 주말 배경

### Phase 3: 고급 기능

- [ ] 호버 툴팁
- [ ] 드래그 앤 드롭
- [ ] 카테고리 필터
- [ ] 담당자 필터
- [ ] 진행률 표시
- [ ] 이미지 Export
- [ ] PDF Export

---

## 🎯 성공 지표

### Phase 1
- ✅ 화살표가 작업 바의 정확한 위치에 연결됨
- ✅ 모든 테스트 시나리오 통과
- ✅ 줌 레벨 변경 시에도 위치 유지

### Phase 2
- ✅ 2번 참고 이미지와 유사한 시각적 품질
- ✅ 부드러운 애니메이션
- ✅ 전문적인 외형

### Phase 3
- ✅ 사용자 피드백 긍정적
- ✅ Export 기능 정상 작동
- ✅ 성능 저하 없음 (60fps 유지)

---

## 🚧 알려진 제약사항

1. **브라우저 호환성**
   - SVG 베지어 곡선은 IE11 미지원
   - `html2canvas`는 일부 CSS 효과 미지원

2. **성능**
   - 작업 100개 이상 시 렌더링 지연 가능
   - 화살표 많을 시 SVG 최적화 필요

3. **접근성**
   - 드래그 앤 드롭은 키보드 접근 불가
   - 화살표 색상만으로 의존성 구분 (색맹 문제)

---

## 📚 참고 자료

- [SVG Path Commands](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
- [Cubic Bezier Curves](https://cubic-bezier.com/)
- [Tailwind CSS Gradients](https://tailwindcss.com/docs/gradient-color-stops)
- [html2canvas Documentation](https://html2canvas.hertzen.com/)
- [jsPDF Documentation](https://github.com/parallax/jsPDF)

---

**문서 버전**: v1.0
**최종 수정**: 2026-01-03
**작성자**: Claude Sonnet 4.5
**검토자**: (미정)
