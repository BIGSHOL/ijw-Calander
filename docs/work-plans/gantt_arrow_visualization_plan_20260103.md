# 간트 차트 화살표 시각화 개선 계획

**작성일**: 2026-01-03
**상태**: ✅ 구현 완료
**예상 소요 시간**: 40분

---

## 현재 문제점

1. **화살표 겹침**: 여러 화살표가 태스크 바와 겹쳐서 가독성 저하
2. **방향 혼란**: 일부 화살표가 왼쪽으로 향함
3. **점선 스타일**: 복잡한 의존성에서 시각적 혼란

---

## 선택된 솔루션: 3가지 조합

### Phase A: 호버 하이라이트 (15분)

**목표**: 기본 상태에서 화살표 희미하게, 호버 시 관련 화살표만 강조

```typescript
const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

// 작업 바에 추가
onMouseEnter={() => setHoveredTaskId(task.id)}
onMouseLeave={() => setHoveredTaskId(null)}

// 화살표 opacity 조정
opacity={
    !hoveredTaskId ? 0.3 : 
    (arrow.fromId === hoveredTaskId || arrow.toId === hoveredTaskId) ? 1 : 0.1
}
```

**효과**:
- 기본: 모든 화살표 opacity 0.3
- 호버: 관련 화살표 opacity 1, 나머지 0.1
- 부드러운 transition 애니메이션

---

### Phase B: 미니 노드 (20분)

**목표**: 화살표 시작/끝점에 작은 원형 노드 추가

```tsx
{dependencyArrows.map((arrow, idx) => (
    <g key={idx}>
        {/* 시작 노드 - 외곽 */}
        <circle cx={arrow.startX} cy={arrow.startY} r="5" 
                fill="#94a3b8" opacity="0.3" />
        {/* 시작 노드 - 중심 */}
        <circle cx={arrow.startX} cy={arrow.startY} r="2" 
                fill="white" />
        
        {/* 화살표 경로 */}
        <path d={arrow.path} stroke="#94a3b8" ... />
        
        {/* 끝 노드 - 외곽 */}
        <circle cx={arrow.endX} cy={arrow.endY} r="5" 
                fill="#94a3b8" opacity="0.3" />
        {/* 끝 노드 - 중심 */}
        <circle cx={arrow.endX} cy={arrow.endY} r="2" 
                fill="white" />
    </g>
))}
```

**효과**:
- 연결점 시각적으로 명확
- 화살표 시작/끝 위치 직관적 파악

---

### Phase C: 점선 → 실선 변경 (5분)

**목표**: 깔끔한 실선 스타일로 변경

```tsx
// Before
strokeDasharray="4 3"

// After
strokeDasharray="none"  // 또는 속성 제거
strokeWidth="1.5"
stroke="#64748b"  // slate-500
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `GanttChart.tsx` | hoveredTaskId state, 화살표 렌더링 로직, 미니 노드 추가 |

---

## 구현 체크리스트

### Phase A: 호버 하이라이트
- [ ] `hoveredTaskId` state 추가
- [ ] 태스크 바에 `onMouseEnter`, `onMouseLeave` 이벤트 추가
- [ ] 화살표 opacity 조건부 렌더링
- [ ] transition 애니메이션 추가

### Phase B: 미니 노드
- [ ] 화살표 데이터에 startX, startY, endX, endY 좌표 추가
- [ ] 시작점 노드 (외곽 + 중심) 렌더링
- [ ] 끝점 노드 (외곽 + 중심) 렌더링
- [ ] 호버 시 노드 색상도 함께 강조

### Phase C: 실선 변경
- [ ] strokeDasharray 제거
- [ ] 선 색상 조정 (#64748b)

---

## 예상 결과

```
기본 상태:
┌─────────┐
│ Task A  │────○ (희미한 화살표 + 노드)
└─────────┘    │
               │
               ▼
┌─────────┐    ○
│ Task B  │◀───┘
└─────────┘

호버 시 (Task A):
┌─────────┐
│ Task A  │════●═══╗ (강조된 화살표 + 밝은 노드)
└─────────┘        ║
                   ║
                   ▼
┌─────────┐        ●
│ Task B  │◀═══════╝
└─────────┘
```

---

## 검증 계획

1. 단일 의존성 테스트
2. 다중 의존성 (2개 이상) 테스트
3. 역방향 의존성 테스트
4. 호버 인터랙션 확인
5. 성능 테스트 (화살표 10개 이상)
