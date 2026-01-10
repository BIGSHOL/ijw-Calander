# 간트 차트 UI/UX 업데이트 (2026-01-03)

## 개요
GanttBuilder 및 GanttChart 컴포넌트의 UI/UX 대폭 개선

**상태**: ✅ Phase 1 & 2 완료

---

## Part 1: GanttBuilder 개선

### 1. 좌우 분할 레이아웃
- **이전**: 세로 스크롤 필요한 긴 폼
- **이후**: 폼(좌 50%) + 등록된 항목(우 50%) 동시 표시
- 공간 효율 약 60% 향상

### 2. 프로젝트 헤더 레이아웃
- **1줄**: 프로젝트 제목 (좌) + 시작일 (우)
- **2줄**: 설명

### 3. 담당자 선택 개선
- 기본값: 로그인한 사용자 자동 선택
- 표시 형식: `호칭 (이메일)` (jobTitle 우선)
- 정렬: 내 계정 최상위, 나머지 호칭 가나다순

### 4. 카테고리 버튼 색상
| 카테고리 | 선택 | 미선택 |
|---------|------|--------|
| 기획 | `bg-blue-600` | `bg-blue-900/40` |
| 개발 | `bg-purple-600` | `bg-purple-900/40` |
| 테스트 | `bg-green-600` | `bg-green-900/40` |
| 기타 | `bg-slate-600` | `bg-slate-700/60` |

### 5. 날짜 표시 형식 변경
- **이전**: "Day 0", "Day 1"
- **이후**: "1월 2일", "1월 3일" (실제 날짜)
- 날짜 색상: `#fdb813` (노란색)

---

## Part 2: GanttChart 개선

### Phase 1: 화살표 버그 수정

#### X 좌표 paddingLeft 오프셋 추가
```typescript
const paddingLeft = 40;
const startX = paddingLeft + (task.startOffset * dayWidth);
const endX = paddingLeft + ((task.startOffset + task.duration) * dayWidth);
```

#### Y 좌표 계산 수정 ✅ 완료
```typescript
groups.forEach((group, groupIndex) => {
    // ✅ 모든 그룹에 mt-8 적용 (실제 DOM과 일치)
    cumulativeY += 32; // mt-8 for ALL groups

    // Group header + mb-4
    const groupHeaderHeight = 24 + 16;
    cumulativeY += groupHeaderHeight;

    group.tasks.forEach(task => {
        const y = cumulativeY + rowHeight / 2;
        positions[task.id] = { x: startX, y, endX };
        cumulativeY += rowHeight;
    });
});
```

**핵심 수정**:
- ❌ Before: `if (groupIndex > 0) cumulativeY += 32;` (첫 그룹 제외)
- ✅ After: `cumulativeY += 32;` (모든 그룹에 적용)
- Timeline header: 74px
- Group margin: 32px (모든 그룹)
- Group header + mb-4: 40px

### Phase 2: UI 고급화

#### 1. 베지어 곡선 화살표
**정방향** (S-커브):
```typescript
const cp1x = startX + deltaX * 0.4;
const cp1y = startY;
const cp2x = startX + deltaX * 0.6;
const cp2y = endY;
path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
```

**역방향** (루프):
```typescript
const loopOffset = Math.abs(deltaY) * 0.3 + 20;
const midY = (startY + endY) / 2;
```

#### 2. Pill 스타일 작업 바
- `rounded-full` (완전 둥근 모서리)
- 그라데이션 배경: `from-cyan-500 to-blue-500`
- 호버 효과: `scale-105 -translate-y-0.5`
- 커스텀 glow: `boxShadow: 0 8px 24px rgba(...)`

#### 3. 3단계 Glow 화살표
| 레이어 | strokeWidth | opacity |
|--------|-------------|---------|
| Outer blur | 14px | 10% |
| Middle glow | 6px | 25% |
| Main line | 2.5px | 100% |

#### 4. 그라데이션 색상 팔레트
| 이름 | 그라데이션 | Glow |
|------|-----------|------|
| Cyan | `from-cyan-500 to-blue-500` | `rgba(6, 182, 212, 0.4)` |
| Orange | `from-orange-500 to-amber-500` | `rgba(249, 115, 22, 0.4)` |
| Pink | `from-pink-500 to-rose-500` | `rgba(236, 72, 153, 0.4)` |
| Emerald | `from-emerald-500 to-green-500` | `rgba(16, 185, 129, 0.4)` |
| Violet | `from-violet-500 to-purple-500` | `rgba(139, 92, 246, 0.4)` |
| Blue | `from-blue-600 to-indigo-600` | `rgba(59, 130, 246, 0.4)` |

### 타임라인 여유 감소
- 기본 최소일: 10일 → 7일
- 마지막 작업 후 여유: 2일 → 1일

---

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `GanttBuilder.tsx` | 좌우 분할 레이아웃, 담당자 정렬, 날짜 형식, 카테고리 색상 |
| `GanttChart.tsx` | paddingLeft 오프셋, 베지어 곡선, Pill 스타일, 3단계 Glow, 그라데이션 팔레트 |
| `GanttManager.tsx` | currentUser prop 전달 |

---

## 추가된 의존성
- `date-fns`: 날짜 포맷팅 (이미 설치됨)
- `date-fns/locale/ko`: 한국어 로케일

