# 학생 목록 탭 UI 개선 검토 보고서

**작성일**: 2026-01-09
**작성자**: Claude Code
**버전**: 1.0

---

## 1. 현재 문제점

사용자 피드백:
- 학생 목록 탭의 좌측 패널 **가로폭이 너무 넓음** (40% 차지)
- 필터/검색 영역이 좌측 패널에서 **공간을 많이 차지**함
- 상단 네비게이션 바 옆에 **빈 공간**이 있음

---

## 2. 현재 레이아웃 구조

```
┌─────────────────────────────────────────────────┐
│ App Header (네비게이션)                          │
├─────────────────────────────────────────────────┤
│ Students Header Bar (📚 전체 | 학생 검색 및 관리) │
│                                    [빈 공간]     │
├────────────────────┬────────────────────────────┤
│ Left Panel (40%)   │ Right Panel (60%)          │
│                    │                            │
│ ┌────────────────┐ │ StudentDetail:             │
│ │ 학생 목록      │ │ - 기본정보                 │
│ │ 총 420명       │ │ - 수업                     │
│ ├────────────────┤ │ - 콜앤상담                 │
│ │ [검색 바     ] │ │                            │
│ ├────────────────┤ │                            │
│ │ [필터 보기 ▼] │ │                            │
│ ├────────────────┤ │                            │
│ │ (필터 패널)    │ │                            │
│ │ - 학년 필터    │ │                            │
│ │ - 상태 필터    │ │                            │
│ │ - 과목 필터    │ │                            │
│ ├────────────────┤ │                            │
│ │ 학생 목록      │ │                            │
│ │ (스크롤)       │ │                            │
│ └────────────────┘ │                            │
└────────────────────┴────────────────────────────┘
```

### 문제점 상세
1. **검색 바**: 좌측 패널 상단에서 고정 높이 차지
2. **필터 토글 버튼**: 항상 표시
3. **필터 패널**: 펼치면 추가 공간 차지 (~130px)
4. **결과**: 실제 학생 목록 표시 영역이 매우 작음

---

## 3. 개선 방안 비교

| 옵션 | 구조 | 난이도 | 효과 | 추천 |
|------|------|--------|------|------|
| **옵션 1** | 검색 바만 상단으로 | 낮음 | 중간 | ⭐⭐⭐ |
| **옵션 2** | 검색 + 필터 드롭다운 상단으로 | 중간 | 높음 | ⭐⭐⭐⭐ |
| **옵션 3** | 검색 상단 + 필터는 Popover | 중간 | 높음 | ⭐⭐⭐ |

---

## 4. 권장 방안: 옵션 2 (Full Integration)

### 4.1 목표 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ App Header (네비게이션)                                       │
├──────────────────────────────────────────────────────────────┤
│ 📚 전체 │ [검색 바    ] │ 학년 ▼ │ 상태 ▼ │ 과목 ▼ │ 정렬 ▼ │
├─────────────────┬────────────────────────────────────────────┤
│ Left (25-30%)   │ Right Panel (70-75%)                       │
│                 │                                            │
│ ┌─────────────┐ │ StudentDetail:                             │
│ │ 학생 목록   │ │ - 기본정보                                 │
│ │ 총 420명    │ │ - 수업                                     │
│ ├─────────────┤ │ - 콜앤상담                                 │
│ │ 학생 카드   │ │                                            │
│ │ (스크롤)    │ │                                            │
│ │             │ │                                            │
│ │             │ │                                            │
│ │             │ │                                            │
│ └─────────────┘ │                                            │
└─────────────────┴────────────────────────────────────────────┘
```

### 4.2 기대 효과

| 항목 | 현재 | 개선 후 | 개선율 |
|------|------|---------|--------|
| 좌측 패널 폭 | 40% | 25-30% | -25~37% |
| 학생 목록 높이 | ~400px | ~550px | +37% |
| 필터 접근성 | 클릭 2회 | 클릭 1회 | 개선 |

### 4.3 다른 탭과의 일관성

- **시간표 탭**: 상단에 필터 드롭다운 통합 ✅
- **출석부 탭**: 상단에 과목/선생님/월 선택 통합 ✅
- **간트차트 탭**: 상단에 프로젝트 선택 통합 ✅

---

## 5. 구현 계획

### Phase 1: State 상향 (1시간)
```typescript
// StudentManagementTab.tsx
const [filters, setFilters] = useState<StudentFilters>({
  searchQuery: '',
  grade: 'all',
  status: 'all',
  subject: 'all',
});
const [sortBy, setSortBy] = useState<'name' | 'grade' | 'startDate'>('name');
```

### Phase 2: 상단 헤더 수정 (2시간)
```typescript
// App.tsx Row 4 (Students mode)
{appMode === 'students' && (
  <div className="bg-[#081429] h-10 flex items-center px-6 gap-2">
    <button className="px-3 py-1 bg-[#fdb813] text-[#081429] rounded-lg">
      📚 전체
    </button>

    <input
      placeholder="이름, 학교 검색..."
      className="flex-1 max-w-xs px-3 py-1 bg-[#1e293b] rounded-md"
      value={studentFilters.searchQuery}
      onChange={(e) => setStudentFilters(prev => ({
        ...prev, searchQuery: e.target.value
      }))}
    />

    <select value={studentFilters.grade}>
      <option value="all">학년</option>
      <option value="초등">초등</option>
      <option value="중등">중등</option>
      <option value="고등">고등</option>
    </select>

    <select value={studentFilters.status}>
      <option value="all">상태</option>
      <option value="active">재원</option>
      <option value="waiting">대기</option>
      <option value="withdrawn">퇴원</option>
    </select>

    <select value={studentFilters.subject}>
      <option value="all">과목</option>
      <option value="math">수학</option>
      <option value="english">영어</option>
    </select>

    <select value={studentSortBy}>
      <option value="name">이름순</option>
      <option value="grade">학년순</option>
      <option value="startDate">입학일순</option>
    </select>
  </div>
)}
```

### Phase 3: StudentList 수정 (1시간)
- 검색 바 제거
- 필터 패널 제거
- 필터 로직은 props로 전달받아 사용

### Phase 4: 반응형 처리 (1시간)
```typescript
// 모바일: 일부 필터 숨기기
<select className="hidden md:block">...</select>
<button className="md:hidden">필터 더보기</button>
```

### Phase 5: 테스트 (1시간)
- 필터링 기능 테스트
- 검색 기능 테스트
- 반응형 테스트

---

## 6. 예상 작업량

| 단계 | 작업 | 소요 시간 |
|------|------|----------|
| Phase 1 | State 상향 | 1시간 |
| Phase 2 | 상단 헤더 수정 | 2시간 |
| Phase 3 | StudentList 수정 | 1시간 |
| Phase 4 | 반응형 처리 | 1시간 |
| Phase 5 | 테스트 | 1시간 |
| **합계** | | **약 6시간** |

---

## 7. 추가 개선사항

### 7.1 필터 초기화 버튼
```typescript
<button onClick={resetFilters} className="text-xs text-red-400">
  초기화
</button>
```

### 7.2 활성 필터 배지
```typescript
const activeCount = [grade !== 'all', status !== 'all', subject !== 'all']
  .filter(Boolean).length;

{activeCount > 0 && (
  <span className="bg-[#fdb813] text-[#081429] px-1.5 rounded-full text-xs">
    {activeCount}
  </span>
)}
```

### 7.3 좌측 패널 폭 조절
```typescript
// 현재
<div className="w-[40%]">

// 개선
<div className="w-[28%] min-w-[280px] max-w-[350px]">
```

---

## 8. 결론

| 항목 | 내용 |
|------|------|
| **문제** | 학생 목록 탭 좌측 패널이 너무 넓음 (40%) |
| **원인** | 필터/검색 영역이 좌측 패널 내부에 위치 |
| **해결책** | 필터/검색을 상단 헤더로 이동 (옵션 2) |
| **효과** | 좌측 패널 25-30%로 축소, 일관성 향상 |
| **난이도** | 중간 (약 6시간) |
| **우선순위** | P2 (사용자 경험 개선) |

**사용자 승인 후 즉시 구현 가능합니다.**
