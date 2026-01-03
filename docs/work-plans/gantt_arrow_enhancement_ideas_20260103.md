# 간트 차트 화살표 시각화 개선 아이디어

**작성일**: 2026-01-03
**상태**: 💡 아이디어 제안
**현재 문제**: 복잡한 의존성 화살표가 겹쳐서 가독성이 떨어짐

---

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [개선 아이디어 6가지](#개선-아이디어-6가지)
3. [추천 조합](#추천-조합)
4. [구현 계획](#구현-계획)
5. [참고 자료](#참고-자료)

---

## 🔍 현재 상태 분석

### 문제점

**스크린샷 분석** (사용자 제공):
```
Task Works ········> 111
    └────────────────> 테스트 주가

Debug Task ········> 테스트 주가

Persistence Task ··> 111
    └────────────────> 테스트 주가
```

**이슈**:
1. ❌ 화살표가 점선(dashed)으로 표시되어 약해 보임
2. ❌ 여러 화살표가 겹쳐서 구분이 어려움
3. ❌ 복잡한 의존성 구조 파악 어려움
4. ❌ 시각적으로 답답함

### 현재 구현

```typescript
// GanttChart.tsx:268-310
<path
    d={arrow.path}
    fill="none"
    stroke={arrow.color}
    strokeWidth="2.5"
    strokeDasharray="4 2"  // ← 점선
    opacity="0.9"
    strokeLinecap="round"
    strokeLinejoin="round"
/>
```

---

## 💡 개선 아이디어 6가지

### 아이디어 1: "플로우 레인" (Flow Lanes)

**평점**: ⭐⭐⭐⭐⭐
**난이도**: 🟡 중간
**효과**: 🟢 높음

#### 컨셉

화살표를 수직 레인으로 분리하여 겹치지 않게 배치

```
┌────────┐
│Task A  │──┐
└────────┘  │ (레인 1)
            ↓
┌────────┐  │
│Task B  │──┼──┐
└────────┘  │  │ (레인 2)
            ↓  ↓
┌────────┐  │  │
│Task C  │──┘  └──→ ┌────────┐
└────────┘          │Task D  │
                    └────────┘
```

#### 구현 방법

1. **레인 할당 알고리즘**

```typescript
// 화살표를 레인에 할당
function assignLanesToArrows(arrows: Arrow[]): Arrow[] {
    const lanes: Array<{ minY: number; maxY: number }> = [];

    return arrows.map(arrow => {
        const arrowMinY = Math.min(arrow.startY, arrow.endY);
        const arrowMaxY = Math.max(arrow.startY, arrow.endY);

        // 겹치지 않는 레인 찾기
        let laneIndex = 0;
        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            // 레인과 겹치지 않으면 사용
            if (arrowMaxY < lane.minY || arrowMinY > lane.maxY) {
                laneIndex = i;
                break;
            }
        }

        // 새 레인 필요 시 추가
        if (laneIndex === lanes.length) {
            lanes.push({ minY: arrowMinY, maxY: arrowMaxY });
        } else {
            // 레인 범위 업데이트
            lanes[laneIndex].minY = Math.min(lanes[laneIndex].minY, arrowMinY);
            lanes[laneIndex].maxY = Math.max(lanes[laneIndex].maxY, arrowMaxY);
        }

        return { ...arrow, lane: laneIndex };
    });
}
```

2. **레인별 X 오프셋 적용**

```typescript
// 베지어 곡선에 레인 오프셋 적용
const laneOffset = arrow.lane * 15; // 레인당 15px 오프셋

if (deltaX > 0) {
    const cp1x = startX + deltaX * 0.4 + laneOffset;
    const cp2x = startX + deltaX * 0.6 + laneOffset;
    path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}
```

#### 장점
- ✅ 화살표 겹침 완전 제거
- ✅ 의존성 흐름 명확
- ✅ 복잡한 구조도 깔끔

#### 단점
- ⚠️ 레인이 많아지면 화살표가 멀리 떨어짐
- ⚠️ 알고리즘 복잡도

---

### 아이디어 2: "호버 하이라이트" (Interactive Highlight)

**평점**: ⭐⭐⭐⭐⭐
**난이도**: 🟢 쉬움
**효과**: 🟢 매우 높음

#### 컨셉

기본적으로 화살표를 희미하게 표시하고, 작업 바 호버 시 관련 화살표만 강조

```
[일반 상태]
모든 화살표: opacity 0.2 (희미)

[Task B 호버]
Task A → Task B: opacity 1.0 (밝게) ✨
Task B → Task C: opacity 1.0 (밝게) ✨
나머지 화살표: opacity 0.05 (거의 투명)
```

#### 구현 방법

1. **호버 상태 관리**

```typescript
const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
const [hoveredArrowIndex, setHoveredArrowIndex] = useState<number | null>(null);
```

2. **작업 바에 호버 이벤트 추가**

```typescript
// GanttChart.tsx:359
<div
    className={`absolute h-[36px] rounded-full ... ${theme.bg}`}
    onMouseEnter={() => setHoveredTaskId(task.id)}
    onMouseLeave={() => setHoveredTaskId(null)}
    style={{ ... }}
>
    {task.title}
</div>
```

3. **화살표 opacity 동적 조정**

```typescript
const getArrowOpacity = (arrow: Arrow, index: number): number => {
    // 화살표 자체에 호버
    if (hoveredArrowIndex === index) return 1;

    // 호버 상태 없음
    if (!hoveredTaskId) return 0.3;

    // 관련 화살표인 경우
    if (arrow.fromId === hoveredTaskId || arrow.toId === hoveredTaskId) {
        return 1;
    }

    // 무관한 화살표
    return 0.05;
};

// 화살표 렌더링
{dependencyArrows.map((arrow, idx) => {
    const opacity = getArrowOpacity(arrow, idx);

    return (
        <g key={idx}>
            {/* Glow */}
            <path
                d={arrow.path}
                stroke={arrow.color}
                strokeWidth="6"
                opacity={opacity * 0.3}
            />
            {/* Main line */}
            <path
                d={arrow.path}
                stroke={arrow.color}
                strokeWidth="2.5"
                opacity={opacity}
                onMouseEnter={() => setHoveredArrowIndex(idx)}
                onMouseLeave={() => setHoveredArrowIndex(null)}
                className="transition-opacity duration-200 cursor-pointer"
            />
        </g>
    );
})}
```

4. **작업 바 Glow 효과 추가**

```typescript
<div
    className={`absolute h-[36px] rounded-full ... ${theme.bg}`}
    style={{
        ...existingStyles,
        // 호버 시 Glow 강화
        boxShadow: hoveredTaskId === task.id
            ? `0 0 40px ${theme.shadowColor}, 0 8px 24px ${theme.shadowColor}`
            : `0 8px 24px ${theme.shadowColor}`,
        // 관련 작업도 살짝 강조
        opacity: !hoveredTaskId ? 1 :
            (isRelated(task.id, hoveredTaskId) ? 1 : 0.5),
        transform: hoveredTaskId === task.id ? 'scale(1.05)' : 'scale(1)'
    }}
>
```

#### 장점
- ✅ 즉시 구현 가능 (1시간)
- ✅ 복잡한 의존성도 깔끔하게 처리
- ✅ 인터랙티브하고 직관적
- ✅ 성능 영향 거의 없음

#### 단점
- ⚠️ 마우스 없는 터치 환경에서는 제한적

---

### 아이디어 3: "미니 노드" (Dependency Nodes)

**평점**: ⭐⭐⭐⭐
**난이도**: 🟢 쉬움
**효과**: 🟡 중간

#### 컨셉

화살표 시작/끝점에 작은 원형 노드를 추가하여 연결점 명확화

```
┌────────┐
│Task A  │●───────────────●
└────────┘                 │
                           ↓
                ┌────────┐ ●
                │Task B  │
                └────────┘
```

#### 구현 방법

```typescript
{dependencyArrows.map((arrow, idx) => (
    <g key={`arrow-${idx}`}>
        {/* 시작점 노드 */}
        <g className="start-node">
            {/* 외곽 Glow */}
            <circle
                cx={arrow.startX}
                cy={arrow.startY}
                r="8"
                fill={arrow.color}
                opacity="0.2"
                filter="blur(2px)"
            />
            {/* 중간 링 */}
            <circle
                cx={arrow.startX}
                cy={arrow.startY}
                r="5"
                fill={arrow.color}
                opacity="0.4"
            />
            {/* 중심점 */}
            <circle
                cx={arrow.startX}
                cy={arrow.startY}
                r="2.5"
                fill="white"
            />
        </g>

        {/* 화살표 경로 */}
        <path d={arrow.path} ... />

        {/* 끝점 노드 */}
        <g className="end-node">
            <circle
                cx={arrow.endX}
                cy={arrow.endY}
                r="8"
                fill={arrow.color}
                opacity="0.2"
                filter="blur(2px)"
            />
            <circle
                cx={arrow.endX}
                cy={arrow.endY}
                r="5"
                fill={arrow.color}
                opacity="0.4"
            />
            <circle
                cx={arrow.endX}
                cy={arrow.endY}
                r="2.5"
                fill="white"
            />
        </g>
    </g>
))}
```

#### 호버 시 애니메이션

```typescript
// CSS transition
.start-node, .end-node {
    transition: all 0.3s ease;
}

.arrow-group:hover .start-node circle:nth-child(1) {
    r: 12;
    opacity: 0.4;
}

.arrow-group:hover .end-node circle:nth-child(1) {
    r: 12;
    opacity: 0.4;
}
```

#### 장점
- ✅ 연결점이 명확
- ✅ 시각적으로 세련됨
- ✅ 구현 간단

#### 단점
- ⚠️ 노드가 많으면 복잡해 보일 수 있음

---

### 아이디어 4: "계층적 화살표" (Hierarchical Arrows)

**평점**: ⭐⭐⭐⭐⭐
**난이도**: 🟡 중간
**효과**: 🟢 높음

#### 컨셉

직접 의존성과 간접 의존성을 시각적으로 구분

```
A → B → C → D

직접 의존성 (1단계):
A → B (실선, 굵게, 밝게)

간접 의존성 (2단계):
A ··> C (점선, 얇게, 흐리게)

간접 의존성 (3단계):
A ···> D (매우 흐림, 거의 투명)
```

#### 구현 방법

1. **의존성 그래프 분석**

```typescript
function calculateDependencyDepth(tasks: GanttSubTask[]): Map<string, Map<string, number>> {
    const depthMap = new Map<string, Map<string, number>>();

    // 각 작업에 대해
    tasks.forEach(task => {
        const depths = new Map<string, number>();

        // BFS로 모든 의존성 탐색
        const queue: Array<{ id: string; depth: number }> =
            (task.dependsOn || []).map(id => ({ id, depth: 1 }));
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;

            if (visited.has(id)) continue;
            visited.add(id);

            depths.set(id, depth);

            // 더 깊은 의존성 추가
            const depTask = tasks.find(t => t.id === id);
            if (depTask?.dependsOn) {
                depTask.dependsOn.forEach(depId => {
                    queue.push({ id: depId, depth: depth + 1 });
                });
            }
        }

        depthMap.set(task.id, depths);
    });

    return depthMap;
}
```

2. **깊이별 스타일 적용**

```typescript
const depthMap = useMemo(() => calculateDependencyDepth(tasks), [tasks]);

const getArrowStyle = (fromId: string, toId: string) => {
    const depths = depthMap.get(toId);
    const depth = depths?.get(fromId) || 1;

    return {
        strokeWidth: depth === 1 ? 3 : depth === 2 ? 2 : 1.5,
        strokeDasharray: depth === 1 ? "none" : depth === 2 ? "6 3" : "3 2",
        opacity: depth === 1 ? 0.9 : depth === 2 ? 0.5 : 0.2,
        zIndex: 10 - depth, // 직접 의존성이 위에
        color: depth === 1 ? arrow.color : `${arrow.color}80` // 간접은 투명하게
    };
};
```

3. **레이어별 렌더링**

```typescript
{/* 레이어 3: 간접 의존성 (3단계 이상) */}
<g className="layer-indirect-deep" opacity="0.1">
    {dependencyArrows
        .filter(arrow => getDepth(arrow) >= 3)
        .map(arrow => renderArrow(arrow))}
</g>

{/* 레이어 2: 간접 의존성 (2단계) */}
<g className="layer-indirect" opacity="0.4">
    {dependencyArrows
        .filter(arrow => getDepth(arrow) === 2)
        .map(arrow => renderArrow(arrow))}
</g>

{/* 레이어 1: 직접 의존성 (1단계) */}
<g className="layer-direct" opacity="0.9">
    {dependencyArrows
        .filter(arrow => getDepth(arrow) === 1)
        .map(arrow => renderArrow(arrow))}
</g>
```

#### 장점
- ✅ Critical Path 시각화
- ✅ 복잡도 직관적 파악
- ✅ 전문적인 프로젝트 관리 도구 느낌

#### 단점
- ⚠️ 간접 의존성 계산 비용
- ⚠️ 너무 많은 레이어는 혼란

---

### 아이디어 5: "레이블 태그" (Labeled Tags)

**평점**: ⭐⭐⭐
**난이도**: 🟡 중간
**효과**: 🟡 중간

#### 컨셉

화살표 중간에 작은 태그로 정보 표시

```
A ──[필수]──> B
C ··[권장]··> D
```

#### 구현 방법

```typescript
{dependencyArrows.map((arrow, idx) => {
    const midX = (arrow.startX + arrow.endX) / 2;
    const midY = (arrow.startY + arrow.endY) / 2;

    return (
        <g key={idx}>
            <path d={arrow.path} ... />

            {/* 태그 */}
            <foreignObject
                x={midX - 25}
                y={midY - 10}
                width="50"
                height="20"
            >
                <div className="flex items-center justify-center">
                    <span className="text-[7px] font-bold bg-slate-800/90 text-white px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-sm">
                        {arrow.type || '필수'}
                    </span>
                </div>
            </foreignObject>
        </g>
    );
})}
```

#### 태그 유형

```typescript
const DEPENDENCY_TYPES = {
    must: { label: '필수', color: 'bg-red-500' },
    recommended: { label: '권장', color: 'bg-blue-500' },
    optional: { label: '선택', color: 'bg-slate-500' }
};
```

#### 장점
- ✅ 의존성 유형 명확
- ✅ 정보가 풍부

#### 단점
- ⚠️ 화살표 많으면 태그가 겹침
- ⚠️ 시각적으로 복잡

---

### 아이디어 6: "Z-인덱스 레이어링" (Z-Index Layering)

**평점**: ⭐⭐⭐⭐⭐
**난이도**: 🟢 쉬움
**효과**: 🟢 높음

#### 컨셉

화살표를 여러 SVG 레이어로 분리하여 겹침 최소화

```
[SVG 구조]
<svg>
    <g class="background-arrows" z-index="10">
        <!-- 멀리 떨어진 화살표 (흐림) -->
    </g>
    <g class="middle-arrows" z-index="20">
        <!-- 중간 거리 화살표 -->
    </g>
    <g class="foreground-arrows" z-index="30">
        <!-- 가까운 화살표 (진함) -->
    </g>
    <g class="hover-arrows" z-index="40">
        <!-- 호버된 화살표 (가장 위) -->
    </g>
</svg>
```

#### 구현 방법

```typescript
const categorizeArrows = (arrows: Arrow[]) => {
    return {
        background: arrows.filter(a => Math.abs(a.endY - a.startY) > 200),
        middle: arrows.filter(a => {
            const dist = Math.abs(a.endY - a.startY);
            return dist > 100 && dist <= 200;
        }),
        foreground: arrows.filter(a => Math.abs(a.endY - a.startY) <= 100)
    };
};

const { background, middle, foreground } = useMemo(
    () => categorizeArrows(dependencyArrows),
    [dependencyArrows]
);

// 렌더링
<svg className="absolute inset-0 pointer-events-none z-20">
    {/* 배경 레이어 - 멀리 떨어진 화살표 */}
    <g className="background-layer" opacity="0.15">
        {background.map((arrow, idx) => renderArrow(arrow, idx, 1.5))}
    </g>

    {/* 중간 레이어 */}
    <g className="middle-layer" opacity="0.4">
        {middle.map((arrow, idx) => renderArrow(arrow, idx, 2))}
    </g>

    {/* 전경 레이어 - 가까운 화살표 */}
    <g className="foreground-layer" opacity="0.8">
        {foreground.map((arrow, idx) => renderArrow(arrow, idx, 2.5))}
    </g>

    {/* 호버 레이어 */}
    {hoveredArrowIndex !== null && (
        <g className="hover-layer" opacity="1">
            {renderArrow(dependencyArrows[hoveredArrowIndex], hoveredArrowIndex, 4)}
        </g>
    )}
</svg>
```

#### 장점
- ✅ 구현 간단
- ✅ 시각적 계층 명확
- ✅ 중요한 것이 위로

#### 단점
- ⚠️ 거리 기준이 절대적일 수 있음

---

## 🏆 추천 조합

### 🥇 Best Practice: "호버 하이라이트 + 미니 노드 + 레이어링"

**왜 이 조합인가?**

1. **호버 하이라이트** → 복잡도 해결 ✨
2. **미니 노드** → 연결점 명확화 ●
3. **Z-인덱스 레이어링** → 시각적 계층 📊

#### 구현 우선순위

```
Phase A (30분): 호버 하이라이트
  ├─ 상태 관리 추가
  ├─ 작업 바 호버 이벤트
  └─ 화살표 opacity 동적 조정

Phase B (30분): 미니 노드
  ├─ 시작/끝점 노드 렌더링
  └─ Glow 효과 추가

Phase C (20분): 레이어링
  ├─ 거리별 화살표 분류
  └─ SVG 레이어 구조 변경

Phase D (20분): 점선 제거
  └─ strokeDasharray="none" 적용
```

**총 소요 시간**: 약 2시간

#### 기대 효과

```
Before:
❌ 화살표가 점선으로 약해 보임
❌ 여러 화살표가 겹쳐서 구분 어려움
❌ 복잡한 의존성 파악 어려움

After:
✅ 실선으로 명확하게 표시
✅ 호버 시 관련 화살표만 강조
✅ 노드로 연결점 명확
✅ 레이어링으로 시각적 계층 형성
✅ 인터랙티브하고 직관적
```

---

## 📊 구현 계획

### Phase A: 호버 하이라이트 (30분)

**파일**: `components/Gantt/GanttChart.tsx`

**Step A1: 상태 추가**
```typescript
// Line 26 근처에 추가
const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
const [hoveredArrowIndex, setHoveredArrowIndex] = useState<number | null>(null);
```

**Step A2: 작업 바 호버 이벤트**
```typescript
// Line 359 수정
<div
    className={`absolute h-[36px] rounded-full ...`}
    onMouseEnter={() => setHoveredTaskId(task.id)}
    onMouseLeave={() => setHoveredTaskId(null)}
    style={{
        // 호버 시 강조
        transform: hoveredTaskId === task.id ? 'scale(1.05)' : 'scale(1)',
        boxShadow: hoveredTaskId === task.id
            ? `0 0 40px ${theme.shadowColor}, 0 8px 24px ${theme.shadowColor}`
            : `0 8px 24px ${theme.shadowColor}`
    }}
>
```

**Step A3: 화살표 opacity 함수**
```typescript
// Line 155 근처에 추가
const getArrowOpacity = useCallback((arrow: Arrow, index: number): number => {
    if (hoveredArrowIndex === index) return 1;
    if (!hoveredTaskId) return 0.3;
    if (arrow.fromId === hoveredTaskId || arrow.toId === hoveredTaskId) return 1;
    return 0.05;
}, [hoveredTaskId, hoveredArrowIndex]);
```

**Step A4: 화살표 렌더링 수정**
```typescript
// Line 273 수정
{dependencyArrows.map((arrow, idx) => {
    const opacity = getArrowOpacity(arrow, idx);

    return (
        <g key={`arrow-${idx}`}>
            {/* Glow */}
            <path
                d={arrow.path}
                stroke={arrow.color}
                strokeWidth="6"
                opacity={opacity * 0.25}
            />
            {/* Main */}
            <path
                d={arrow.path}
                stroke={arrow.color}
                strokeWidth="2.5"
                opacity={opacity}
                onMouseEnter={() => setHoveredArrowIndex(idx)}
                onMouseLeave={() => setHoveredArrowIndex(null)}
                className="transition-all duration-200 cursor-pointer"
                style={{ pointerEvents: 'stroke' }}
            />
        </g>
    );
})}
```

---

### Phase B: 미니 노드 (30분)

**Step B1: 노드 렌더링 함수**
```typescript
const renderConnectionNode = (x: number, y: number, color: string) => (
    <g className="connection-node">
        {/* Outer glow */}
        <circle cx={x} cy={y} r="8" fill={color} opacity="0.2" filter="blur(2px)" />
        {/* Middle ring */}
        <circle cx={x} cy={y} r="5" fill={color} opacity="0.4" />
        {/* Center dot */}
        <circle cx={x} cy={y} r="2.5" fill="white" />
    </g>
);
```

**Step B2: 화살표에 노드 추가**
```typescript
{dependencyArrows.map((arrow, idx) => (
    <g key={`arrow-${idx}`}>
        {/* 시작 노드 */}
        {renderConnectionNode(arrow.startX, arrow.startY, arrow.color)}

        {/* 화살표 경로 */}
        <path ... />

        {/* 끝 노드 */}
        {renderConnectionNode(arrow.endX, arrow.endY, arrow.color)}
    </g>
))}
```

---

### Phase C: 레이어링 (20분)

**Step C1: 화살표 분류 함수**
```typescript
const categorizedArrows = useMemo(() => {
    const bg: Arrow[] = [];
    const mid: Arrow[] = [];
    const fg: Arrow[] = [];

    dependencyArrows.forEach(arrow => {
        const distance = Math.abs(arrow.endY - arrow.startY);
        if (distance > 200) bg.push(arrow);
        else if (distance > 100) mid.push(arrow);
        else fg.push(arrow);
    });

    return { background: bg, middle: mid, foreground: fg };
}, [dependencyArrows]);
```

**Step C2: 레이어별 렌더링**
```typescript
<svg className="absolute inset-0 pointer-events-none z-20">
    {/* Background layer */}
    <g opacity="0.15">
        {categorizedArrows.background.map(renderArrow)}
    </g>

    {/* Middle layer */}
    <g opacity="0.4">
        {categorizedArrows.middle.map(renderArrow)}
    </g>

    {/* Foreground layer */}
    <g opacity="0.8">
        {categorizedArrows.foreground.map(renderArrow)}
    </g>
</svg>
```

---

### Phase D: 점선 제거 (20분)

**파일**: `components/Gantt/GanttChart.tsx`

**변경 위치**: Line 290 근처

**Before**:
```typescript
strokeDasharray="4 2"
```

**After**:
```typescript
strokeDasharray="none"
```

또는 완전히 제거:
```typescript
<path
    d={arrow.path}
    stroke={arrow.color}
    strokeWidth="2.5"
    // strokeDasharray 제거
    opacity={opacity}
/>
```

---

## 🎯 성공 지표

### 시각적 품질
- [ ] 화살표가 실선으로 명확하게 표시
- [ ] 호버 시 관련 화살표만 강조
- [ ] 노드로 연결점 명확
- [ ] 레이어링으로 시각적 계층 형성

### 사용성
- [ ] 복잡한 의존성도 쉽게 파악
- [ ] 호버 시 부드러운 애니메이션
- [ ] 성능 저하 없음 (60fps)

### 전문성
- [ ] 참고 이미지보다 더 세련된 UI
- [ ] 프로젝트 관리 도구 수준

---

## 📚 참고 자료

### 영감 출처
- [GitHub Network Graph](https://github.com/) - 호버 하이라이트
- [Jira Timeline](https://www.atlassian.com/software/jira) - 레이어링
- [Monday.com Gantt](https://monday.com/) - 미니 노드

### 기술 문서
- [SVG Path Commands](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
- [React useState Hook](https://react.dev/reference/react/useState)
- [CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions)

---

## 🔄 대안 아이디어

### 추가 고려사항

1. **애니메이션 경로**
   - 화살표를 따라 점이 이동하는 애니메이션
   - `stroke-dashoffset` 애니메이션

2. **의존성 강도 표시**
   - 화살표 굵기로 중요도 표현
   - 필수 의존성: 굵게
   - 선택 의존성: 얇게

3. **색상 코딩**
   - 의존성 유형별 색상
   - 완료된 작업: 초록색 화살표
   - 대기 중: 회색 화살표

---

**문서 버전**: v1.0
**최종 수정**: 2026-01-03
**작성자**: Claude Sonnet 4.5
**관련 문서**: [gantt_ui_update_20260103.md](./gantt_ui_update_20260103.md)
