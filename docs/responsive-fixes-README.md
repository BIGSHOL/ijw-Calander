# 반응형 디자인 수정 가이드

> ijw-calander 프로젝트 화면 짤림 현상 해결 방안

## 개요

이 문서는 **ijw-calander 프로젝트의 디스플레이 해상도 문제**를 분석하고, 즉시 적용 가능한 해결책을 제시합니다.

### 문제 요약
- **고정 너비** 사용으로 인한 모바일 기기에서 레이아웃 깨짐
- **overflow-hidden** 남용으로 콘텐츠 잘림
- **반응형 breakpoint** 처리 미흡

### 해결 범위
- ✅ 320px ~ 1920px 모든 해상도 대응
- ✅ 모바일/태블릿/데스크톱 최적화
- ✅ 기존 기능 손상 없이 수정

---

## 제공 문서

### 1. RESPONSIVE_DESIGN_ANALYSIS.md
**종합 분석 보고서** (21,000자)

**포함 내용**:
- 발견된 문제점 12개 (파일:라인 번호 포함)
- 우선순위별 수정 목록 (P0/P1/P2)
- 즉시 적용 가능한 CSS 수정안
- 장기적 리팩토링 방안
- 반응형 디자인 가이드라인

**대상**: 프로젝트 리드, 시니어 개발자

---

### 2. responsive-fixes-p0.patch
**즉시 적용 패치 파일**

**포함 내용**:
- P0 수정 사항 13개 (Before/After)
- 파일별 라인 번호 명시
- 테스트 체크리스트

**대상**: 개발자 (즉시 적용용)

**적용 방법**:
```bash
# 파일 내용을 참고하여 수동 적용
# 각 변경 사항은 독립적으로 적용 가능
```

---

### 3. responsive-quick-reference.md
**빠른 참조 가이드** (실용 예제 중심)

**포함 내용**:
- 즉시 사용 가능한 10가지 패턴
- 실전 예제 4개 (복사-붙여넣기 가능)
- 디버깅 팁
- useMediaQuery Hook
- 개발 체크리스트

**대상**: 모든 개발자 (일상 개발용)

---

## 빠른 시작

### Step 1: 분석 보고서 읽기 (10분)

```bash
# 1. 전체 상황 파악
code docs/RESPONSIVE_DESIGN_ANALYSIS.md

# 2. 발견된 문제점 섹션 읽기
# 3. 우선순위 P0 수정 목록 확인
```

---

### Step 2: P0 수정 적용 (30분)

**13개 수정 사항** (기능 손상 방지):

#### 1. App.tsx - 메인 레이아웃 (5개)
```tsx
// 라인 1684: overflow-hidden → overflow-auto
<main className="flex-1 flex flex-col md:flex-row overflow-auto">

// 라인 1695, 1724, 1748: 칼럼 레이아웃
<div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0">

// 라인 1349: 프로필 드롭다운
<div className="absolute right-0 mt-2 w-screen max-w-sm md:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-y-auto max-h-[80vh]">

// 라인 1881, 2057, 2134: 모달 3개
<div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[99999] overflow-y-auto flex flex-col">
```

#### 2. CalendarBoard.tsx (2개)
```tsx
// 라인 437: min-w-[350px] → min-w-[280px]
<div className="flex-1 bg-white shadow-xl print:shadow-none p-3 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[280px] flex flex-col overflow-y-auto">

// 라인 74: 높이 계산 반응형
<div className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] overflow-y-auto bg-white rounded-xl border border-gray-200">
```

#### 3. TimetableManager.tsx (1개)
```tsx
// 라인 439: overflow 처리
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-y-auto overflow-x-auto">
```

#### 4. Attendance/components/Table.tsx (5개)
```tsx
// 라인 296-309: Sticky Header + 날짜 셀
// p-3 → p-2 md:p-3
// min-w-[100px] → min-w-[80px] md:min-w-[100px]
// text-sm → text-xs md:text-sm
```

**상세 내용**: `docs/responsive-fixes-p0.patch` 참조

---

### Step 3: 테스트 (20분)

```bash
# 1. 개발 서버 실행
npm run dev

# 2. Chrome DevTools (F12) > Device Mode (Cmd+Shift+M)

# 3. 다음 해상도에서 테스트:
```

**필수 테스트 해상도**:
- [ ] 320px (iPhone SE) - 최소 지원
- [ ] 375px (iPhone 13)
- [ ] 768px (iPad 세로)
- [ ] 1024px (iPad 가로)
- [ ] 1920px (Full HD)

**확인 사항**:
- [ ] 가로 스크롤 없음
- [ ] 모든 모달이 화면 안에 표시
- [ ] 테이블 스크롤 작동
- [ ] 버튼/링크 터치 가능

---

### Step 4: 추가 개선 (선택사항)

P1/P2 수정 사항은 팀 일정에 따라 진행:

**P1 (이번 주)**:
- 헤더 최소 너비 조정
- 프로필 드롭다운 개선
- 추가 모달 통일

**P2 (다음 스프린트)**:
- BaseModal 컴포넌트 생성
- CSS 변수 도입
- 테이블 Card View 추가

---

## 주요 개선 사항

### Before (문제)
```tsx
// ❌ 고정 너비로 모바일에서 잘림
<div className="w-[400px]">

// ❌ overflow-hidden으로 콘텐츠 숨김
<div className="overflow-hidden">

// ❌ 고정 최소 너비로 가로 스크롤 발생
<div className="min-w-[350px]">
```

### After (해결)
```tsx
// ✅ 반응형 최대 너비
<div className="w-full max-w-sm mx-4">

// ✅ 스크롤 가능
<div className="overflow-y-auto">

// ✅ 모바일 대응 최소 너비
<div className="min-w-[280px]">
```

---

## 핵심 패턴 (외워두세요!)

### 1. 모달
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
  <div className="bg-white rounded-2xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
    {/* 내용 */}
  </div>
</div>
```

### 2. 컨테이너
```tsx
<div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0">
  {/* 내용 */}
</div>
```

### 3. 테이블
```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    <th className="p-2 md:p-3 text-xs md:text-sm">
      {/* 헤더 */}
    </th>
  </table>
</div>
```

### 4. 버튼
```tsx
<button className="px-4 md:px-6 py-2.5 md:py-3 min-h-[44px] text-sm md:text-base">
  클릭
</button>
```

---

## 자주 묻는 질문

### Q1. P0 수정만 적용하면 충분한가요?
**A**: 네, P0 수정으로 **기능 손상 및 주요 레이아웃 깨짐은 해결**됩니다. P1/P2는 사용성 및 코드 품질 개선입니다.

### Q2. 기존 기능이 깨질 수 있나요?
**A**: P0 수정은 **CSS 클래스만 변경**하므로 로직에 영향 없습니다. 단, 반드시 테스트는 해야 합니다.

### Q3. 어떤 순서로 수정해야 하나요?
**A**: 파일 순서대로 (App.tsx → CalendarBoard → TimetableManager → Table) 적용하되, 각 수정은 독립적입니다.

### Q4. 수정 후 문제가 생기면?
**A**:
1. 해당 변경 사항만 되돌리기 (git revert)
2. GitHub Issue에 보고
3. 대안 패턴은 `responsive-quick-reference.md` 참조

### Q5. 새로운 컴포넌트 개발 시 주의사항은?
**A**:
- 고정 픽셀 너비 금지 (w-[400px] ❌)
- 항상 max-w-* 사용 (max-w-md ✅)
- overflow-hidden 신중히 사용
- 개발 체크리스트 활용

---

## 추가 지원

### 문서 구조
```
docs/
├── RESPONSIVE_DESIGN_ANALYSIS.md      # 종합 분석 (21,000자)
├── responsive-fixes-p0.patch          # 즉시 적용 패치
├── responsive-quick-reference.md      # 빠른 참조 가이드
└── responsive-fixes-README.md         # 이 문서
```

### 학습 경로

**초급 개발자**:
1. 이 README 읽기 (10분)
2. `responsive-quick-reference.md` 패턴 학습 (30분)
3. P0 패치 적용 (30분)

**중급 개발자**:
1. `RESPONSIVE_DESIGN_ANALYSIS.md` 전체 읽기 (1시간)
2. P0/P1 수정 적용 (2시간)
3. BaseModal 컴포넌트 생성 (1시간)

**시니어 개발자**:
1. 전체 문서 리뷰 (2시간)
2. 팀 교육 자료 준비 (1시간)
3. 장기 리팩토링 계획 수립 (2시간)

---

## 체크리스트

### 적용 전
- [ ] 전체 문서 읽음
- [ ] 현재 코드 백업 (git branch)
- [ ] 테스트 환경 준비

### 적용 중
- [ ] P0 수정 13개 적용 완료
- [ ] 각 파일별 저장 및 확인
- [ ] Prettier/ESLint 통과

### 적용 후
- [ ] 5개 해상도 테스트 완료
- [ ] 가로 스크롤 없음 확인
- [ ] 모달 정상 작동 확인
- [ ] 테이블 스크롤 확인
- [ ] Git commit + push

---

## 참고 자료

- [Tailwind CSS - Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN - Mobile First](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Responsive/Mobile_first)
- [Google - Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

---

## 버전 정보

- **문서 버전**: 1.0
- **프로젝트**: ijw-calander
- **작성일**: 2026-01-08
- **작성자**: 리팩토링 전문가 에이전트

---

## 다음 단계

1. **즉시**: P0 수정 적용 및 테스트
2. **이번 주**: P1 수정 계획 수립
3. **다음 스프린트**: BaseModal 컴포넌트 및 CSS 변수 도입
4. **지속적**: 신규 개발 시 `responsive-quick-reference.md` 참조

---

**수정 사항이나 질문이 있으면 GitHub Issue를 생성해주세요.**

Happy Coding! 🚀
