# 반응형 디자인 분석 보고서

> 생성일: 2026-01-08
> 프로젝트: ijw-calander
> 분석자: 리팩토링 전문가 에이전트

---

## 목차
1. [분석 요약](#분석-요약)
2. [발견된 문제점](#발견된-문제점)
3. [우선순위별 수정 목록](#우선순위별-수정-목록)
4. [즉시 적용 가능한 CSS 수정안](#즉시-적용-가능한-css-수정안)
5. [장기적 리팩토링 방안](#장기적-리팩토링-방안)
6. [반응형 디자인 가이드라인](#반응형-디자인-가이드라인)

---

## 분석 요약

### 현재 상태
- **복잡도**: Medium-High
- **Tailwind CSS 활용**: 양호 (대부분 유틸리티 클래스 사용)
- **주요 문제**: 고정 너비 사용, overflow 처리 미흡, 모바일 대응 부족

### 전체적인 평가
ijw-calander 프로젝트는 **Tailwind CSS를 활용한 모던한 구조**를 가지고 있으나, 다음과 같은 **반응형 디자인 문제**가 존재합니다:

1. **고정 너비 문제**: 모달 및 일부 컴포넌트에서 고정 픽셀 값 사용
2. **Overflow 처리 부족**: 콘텐츠가 넘칠 때 적절한 스크롤 처리 미흡
3. **모바일 최적화 부족**: 작은 화면에서 UI 요소가 잘림
4. **Flexbox 레이아웃 취약점**: flex-1 사용 시 최소 너비 고려 부족

---

## 발견된 문제점

### 1. 메인 레이아웃 (App.tsx) - 높음

#### 문제 1-1: 헤더 고정 너비 (라인 1182)
```tsx
// 현재 코드 (문제)
<div className="flex items-center gap-3 min-w-[250px]">
```

- **문제**: 250px 고정 최소 너비로 인해 320px 모바일에서 레이아웃 깨짐
- **영향도**: 높음 - 모든 화면에서 보이는 헤더
- **영향 해상도**: 320px ~ 500px

#### 문제 1-2: 프로필 드롭다운 고정 너비 (라인 1349)
```tsx
// 현재 코드 (문제)
<div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-hidden">
```

- **문제**: w-80 (320px) 고정 너비, 작은 화면에서 화면 밖으로 넘침
- **영향도**: 중간
- **영향 해상도**: < 400px

#### 문제 1-3: 메인 콘텐츠 Overflow (라인 1684-1748)
```tsx
// 현재 코드 (문제)
<main className="flex-1 flex flex-col md:flex-row overflow-hidden">
  <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
```

- **문제**: overflow-hidden으로 인해 콘텐츠가 잘리고 스크롤 불가
- **영향도**: 높음
- **영향 해상도**: 모든 해상도에서 콘텐츠 양에 따라 발생

#### 문제 1-4: 모달 고정 너비 (라인 1881, 2057, 2134)
```tsx
// 문제 코드들
md:w-[500px]  // 라인 1881
w-[400px]     // 라인 2057, 2134
```

- **문제**: 모바일에서 고정 너비 모달이 화면을 넘침
- **영향도**: 높음
- **영향 해상도**: < 500px

---

### 2. CalendarBoard.tsx - 높음

#### 문제 2-1: 최소 너비 설정 (라인 437)
```tsx
// 현재 코드
<div className="flex-1 bg-white shadow-xl print:shadow-none p-4 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[350px] flex flex-col overflow-hidden">
```

- **문제**: min-w-[350px]로 인해 320px 모바일에서 가로 스크롤 발생
- **영향도**: 높음
- **제안**: min-w-[280px] 또는 min-w-0

#### 문제 2-2: Daily View 고정 높이 (라인 74)
```tsx
// 현재 코드
<div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-white rounded-xl border border-gray-200">
```

- **문제**: 200px 고정 빼기는 헤더 높이 변동에 취약
- **영향도**: 중간
- **제안**: CSS 변수 또는 동적 계산 사용

---

### 3. TimetableManager.tsx - 중간

#### 문제 3-1: 전체 컨테이너 Overflow (라인 439)
```tsx
// 현재 코드
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
```

- **문제**: overflow-hidden으로 시간표가 많을 때 스크롤 불가
- **영향도**: 중간
- **제안**: overflow-auto 또는 overflow-y-auto 사용

---

### 4. AttendanceManager 출석부 테이블 - 높음

#### 문제 4-1: Sticky Header 고정 위치 (components/Attendance/components/Table.tsx)
```tsx
// 라인 296-297
<th className="p-3 sticky left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">이름</th>
<th className="p-3 sticky left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">학교/학년</th>
```

- **문제**: left-[148px] 고정 픽셀 값, 반응형 불가
- **영향도**: 높음
- **제안**: CSS Grid 또는 동적 계산 사용

#### 문제 4-2: 컨텍스트 메뉴 고정 너비 (라인 349)
```tsx
<div className="context-menu-container fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 origin-top-left">
```

- **문제**: min-w-[180px], 좁은 화면에서 잘릴 수 있음
- **영향도**: 낮음

---

### 5. Gantt Chart (GanttChart.tsx) - 중간

#### 문제 5-1: 최대 너비 제한 (라인 381)
```tsx
<div className="flex-1 w-full overflow-hidden relative bg-gray-50 rounded-tl-3xl border-t border-l border-gray-200 shadow-2xl mx-auto max-w-[98%]">
```

- **문제**: max-w-[98%]는 문제 없으나, 내부 콘텐츠가 고정 너비일 경우 여전히 잘림
- **영향도**: 중간
- **제안**: 내부 차트 요소도 반응형으로 조정

---

### 6. Modal 컴포넌트들 - 높음

여러 모달에서 공통적으로 발견된 문제:

```tsx
// EventModal.tsx (라인 327)
w-full max-w-2xl  // 좋음
max-h-[90vh]      // 좋음
overflow-hidden   // 문제: 내부 스크롤 필요

// SettlementModal, SalarySettings 등
w-[400px]         // 문제: 고정 너비
max-w-md          // 좋음 (사용 시)
```

- **문제**: 일부 모달은 고정 너비, 일부는 max-w-* 사용으로 일관성 부족
- **영향도**: 높음
- **제안**: 모든 모달을 `w-full max-w-*` 패턴으로 통일

---

## 우선순위별 수정 목록

### P0 (즉시 수정 필요) - 기능 손상 방지

#### 1. App.tsx - 메인 레이아웃 Overflow
**파일**: `App.tsx`
**라인**: 1684, 1695, 1724, 1748

**현재 코드**:
```tsx
<main className="flex-1 flex flex-col md:flex-row overflow-hidden">
  <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
```

**수정안**:
```tsx
<main className="flex-1 flex flex-col md:flex-row overflow-auto">
  <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0">
```

**이유**: 콘텐츠가 잘리는 것을 방지하고 스크롤 가능하게 만듦

---

#### 2. App.tsx - 모달 고정 너비 제거
**파일**: `App.tsx`
**라인**: 1881, 2057, 2134

**현재 코드**:
```tsx
<div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:max-h-[80vh]">
<div className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[90vh] overflow-hidden">
```

**수정안**:
```tsx
<div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[80vh]">
<div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
```

**이유**: 모바일에서 모달이 화면 밖으로 나가는 것 방지

---

#### 3. CalendarBoard.tsx - 최소 너비 조정
**파일**: `components/Calendar/CalendarBoard.tsx`
**라인**: 437

**현재 코드**:
```tsx
<div className="flex-1 bg-white shadow-xl print:shadow-none p-4 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[350px] flex flex-col overflow-hidden">
```

**수정안**:
```tsx
<div className="flex-1 bg-white shadow-xl print:shadow-none p-3 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[280px] flex flex-col overflow-y-auto">
```

**이유**: 320px 모바일 기기에서도 표시 가능하도록 조정

---

#### 4. CalendarBoard.tsx - Daily View 높이 계산
**파일**: `components/Calendar/CalendarBoard.tsx`
**라인**: 74

**현재 코드**:
```tsx
<div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-white rounded-xl border border-gray-200">
```

**수정안**:
```tsx
<div className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] overflow-y-auto bg-white rounded-xl border border-gray-200">
```

**이유**: 모바일에서 더 많은 공간 확보, overflow-hidden → overflow-y-auto로 스크롤 가능

---

#### 5. Attendance Table - Sticky Header 위치
**파일**: `components/Attendance/components/Table.tsx`
**라인**: 296-297

**현재 코드**:
```tsx
<th className="p-3 sticky left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">이름</th>
<th className="p-3 sticky left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">학교/학년</th>
```

**수정안**:
```tsx
<th className="p-2 md:p-3 sticky left-10 md:left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[80px] md:min-w-[100px] align-middle">이름</th>
<th className="p-2 md:p-3 sticky left-[120px] md:left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[80px] md:min-w-[100px] align-middle">학교/학년</th>
```

**이유**: 모바일에서 padding과 position 조정하여 더 많은 공간 확보

---

### P1 (이번 주 수정 권장) - 사용성 개선

#### 6. App.tsx - 헤더 최소 너비 조정
**파일**: `App.tsx`
**라인**: 1182, 1305

**현재 코드**:
```tsx
<div className="flex items-center gap-3 min-w-[250px]">
<div className="flex items-center justify-end gap-3 w-[250px]">
```

**수정안**:
```tsx
<div className="flex items-center gap-2 md:gap-3 min-w-[180px] md:min-w-[250px]">
<div className="flex items-center justify-end gap-2 md:gap-3 w-auto md:w-[250px]">
```

**이유**: 모바일에서 헤더 요소가 유연하게 배치되도록 조정

---

#### 7. TimetableManager - Overflow 처리
**파일**: `components/Timetable/TimetableManager.tsx`
**라인**: 439

**현재 코드**:
```tsx
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
```

**수정안**:
```tsx
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-y-auto overflow-x-auto">
```

**이유**: 시간표가 많을 때 스크롤 가능하도록 변경

---

#### 8. 프로필 드롭다운 너비 조정
**파일**: `App.tsx`
**라인**: 1349

**현재 코드**:
```tsx
<div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-hidden">
```

**수정안**:
```tsx
<div className="absolute right-0 mt-2 w-screen max-w-sm md:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-y-auto max-h-[80vh]">
```

**이유**: 작은 화면에서도 드롭다운이 화면 안에 표시되도록 조정

---

### P2 (다음 스프린트) - 코드 품질 개선

#### 9. 모든 Modal 컴포넌트 통일
**영향 파일**:
- `components/Calendar/EventModal.tsx`
- `components/Attendance/components/SettlementModal.tsx`
- `components/Attendance/components/SalarySettings.tsx`
- `components/Calendar/BucketModal.tsx`
- `components/Auth/LoginModal.tsx`

**표준 패턴**:
```tsx
// 권장 모달 구조
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
  <div
    className="bg-white rounded-2xl shadow-2xl w-full max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
    onClick={(e) => e.stopPropagation()}
  >
    {/* 모달 내용 */}
  </div>
</div>
```

**이유**: 일관된 모달 UX, 모든 화면 크기 대응

---

#### 10. GanttChart - 내부 요소 반응형 개선
**파일**: `components/Gantt/GanttChart.tsx`
**라인**: 381 이하

**제안**:
- 차트 내부 SVG/Canvas 요소에 viewBox 및 preserveAspectRatio 속성 추가
- 타임라인 요소를 백분율 기반으로 변경

---

#### 11. Attendance Table - 최소 너비들 반응형 조정
**파일**: `components/Attendance/components/Table.tsx`
**라인**: 300-301, 309

**현재 코드**:
```tsx
<th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[125px] text-center bg-[#ffffff]/5 align-middle">요일</th>
<th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[60px] text-center bg-[#ffffff]/5 align-middle">출석</th>
```

**수정안**:
```tsx
<th className="p-2 md:p-3 border-r border-b border-[#ffffff]/10 min-w-[100px] md:min-w-[125px] text-center bg-[#ffffff]/5 align-middle text-xs md:text-sm">요일</th>
<th className="p-2 md:p-3 border-r border-b border-[#ffffff]/10 min-w-[50px] md:min-w-[60px] text-center bg-[#ffffff]/5 align-middle text-xs md:text-sm">출석</th>
```

**이유**: 모바일에서 테이블 컬럼 너비를 줄여 더 많은 정보 표시

---

#### 12. Daily View - Time Grid 반응형 조정
**파일**: `components/Calendar/CalendarBoard.tsx`
**라인**: 69-70 (HOUR_HEIGHT 상수)

**현재 코드**:
```tsx
const HOUR_HEIGHT = 80;
```

**수정안**:
```tsx
const HOUR_HEIGHT = window.innerWidth < 640 ? 60 : 80; // 또는 CSS 변수 사용
```

**이유**: 모바일에서 시간 그리드 높이를 줄여 더 많은 시간대 표시

---

## 즉시 적용 가능한 CSS 수정안

다음은 **기능 손상 없이** 즉시 적용 가능한 CSS 클래스 수정 목록입니다.

### 파일별 수정 사항

#### 1. App.tsx

```diff
--- a/App.tsx
+++ b/App.tsx

@@ -1182 +1182 @@
-          <div className="flex items-center gap-3 min-w-[250px]">
+          <div className="flex items-center gap-2 md:gap-3 min-w-[180px] md:min-w-[250px]">

@@ -1305 +1305 @@
-          <div className="flex items-center justify-end gap-3 w-[250px]">
+          <div className="flex items-center justify-end gap-2 md:gap-3 w-auto md:w-[250px]">

@@ -1349 +1349 @@
-                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-hidden">
+                    <div className="absolute right-0 mt-2 w-screen max-w-sm md:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-y-auto max-h-[80vh]">

@@ -1684 +1684 @@
-      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
+      <main className="flex-1 flex flex-col md:flex-row overflow-auto">

@@ -1695 +1695 @@
-            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
+            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0">

@@ -1724 +1724 @@
-            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0 transition-all duration-300 ${viewColumns >= 2 ? '' : 'hidden'}`}>
+            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0 transition-all duration-300 ${viewColumns >= 2 ? '' : 'hidden'}`}>

@@ -1748 +1748 @@
-            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0 transition-all duration-300 ${viewColumns >= 3 ? '' : 'hidden'}`}>
+            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-y-auto overflow-x-hidden min-w-0 transition-all duration-300 ${viewColumns >= 3 ? '' : 'hidden'}`}>

@@ -1881 +1881 @@
-            <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[99999] overflow-hidden flex flex-col">
+            <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[99999] overflow-y-auto flex flex-col">

@@ -2057 +2057 @@
-            <div className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[90vh] overflow-hidden">
+            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">

@@ -2134 +2134 @@
-            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
+            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-y-auto max-h-[90vh]">
```

---

#### 2. CalendarBoard.tsx

```diff
--- a/components/Calendar/CalendarBoard.tsx
+++ b/components/Calendar/CalendarBoard.tsx

@@ -74 +74 @@
-    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-white rounded-xl border border-gray-200">
+    <div className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] overflow-y-auto bg-white rounded-xl border border-gray-200">

@@ -437 +437 @@
-    <div className="flex-1 bg-white shadow-xl print:shadow-none p-4 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[350px] flex flex-col overflow-hidden">
+    <div className="flex-1 bg-white shadow-xl print:shadow-none p-3 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[280px] flex flex-col overflow-y-auto">
```

---

#### 3. TimetableManager.tsx

```diff
--- a/components/Timetable/TimetableManager.tsx
+++ b/components/Timetable/TimetableManager.tsx

@@ -439 +439 @@
-        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
+        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-y-auto overflow-x-auto">
```

---

#### 4. Attendance/components/Table.tsx

```diff
--- a/components/Attendance/components/Table.tsx
+++ b/components/Attendance/components/Table.tsx

@@ -296 +296 @@
-              <th className="p-3 sticky left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">이름</th>
+              <th className="p-2 md:p-3 sticky left-10 md:left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[80px] md:min-w-[100px] align-middle text-xs md:text-sm">이름</th>

@@ -297 +297 @@
-              <th className="p-3 sticky left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">학교/학년</th>
+              <th className="p-2 md:p-3 sticky left-[120px] md:left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[80px] md:min-w-[100px] align-middle text-xs md:text-sm">학교/학년</th>

@@ -300 +300 @@
-              <th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[125px] text-center bg-[#ffffff]/5 align-middle">요일</th>
+              <th className="p-2 md:p-3 border-r border-b border-[#ffffff]/10 min-w-[100px] md:min-w-[125px] text-center bg-[#ffffff]/5 align-middle text-xs md:text-sm">요일</th>

@@ -301 +301 @@
-              <th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[60px] text-center bg-[#ffffff]/5 align-middle">출석</th>
+              <th className="p-2 md:p-3 border-r border-b border-[#ffffff]/10 min-w-[50px] md:min-w-[60px] text-center bg-[#ffffff]/5 align-middle text-xs md:text-sm">출석</th>

@@ -309 +309 @@
-                    className={`p-2 border-r border-b border-[#ffffff]/10 min-w-[50px] text-center align-middle ${isWeekend ? 'text-red-300' : 'text-gray-300'
+                    className={`p-1 md:p-2 border-r border-b border-[#ffffff]/10 min-w-[45px] md:min-w-[50px] text-center align-middle text-xs ${isWeekend ? 'text-red-300' : 'text-gray-300'
```

---

## 장기적 리팩토링 방안

### 1. CSS 변수 도입

**목표**: 반복되는 고정 값을 변수화하여 일관성 확보

```css
/* index.css에 추가 */
:root {
  /* Responsive Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  /* Layout Dimensions */
  --header-height: 64px;
  --header-height-mobile: 56px;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 64px;

  /* Modal Dimensions */
  --modal-max-width-sm: 400px;
  --modal-max-width-md: 600px;
  --modal-max-width-lg: 800px;

  /* Table Dimensions */
  --table-cell-min-width: 100px;
  --table-cell-min-width-mobile: 80px;

  /* Z-index Layers */
  --z-modal: 9999;
  --z-dropdown: 100;
  --z-sticky: 30;
}

@media (max-width: 640px) {
  :root {
    --header-height: var(--header-height-mobile);
  }
}
```

**사용 예시**:
```tsx
// Before
<div className="h-[64px]">

// After
<div style={{ height: 'var(--header-height)' }}>
// 또는 Tailwind 설정에서 커스텀 값으로 등록
```

---

### 2. 컨테이너 쿼리 도입 (CSS Container Queries)

**목표**: 부모 컨테이너 크기에 따른 반응형 디자인

```css
/* 예시: 캘린더 셀 */
.calendar-cell {
  container-type: inline-size;
  container-name: calendar-cell;
}

@container calendar-cell (max-width: 100px) {
  .event-title {
    font-size: 0.75rem;
  }
}
```

**적용 대상**:
- CalendarBoard 내부 WeekBlock
- TimetableManager 셀
- GanttChart 타임라인 요소

---

### 3. 컴포넌트 분리 및 재사용

#### 문제: 모달 코드 중복
여러 파일에서 모달 구조가 반복됨

#### 해결책: BaseModal 컴포넌트 생성

```tsx
// components/Common/BaseModal.tsx
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  className = ''
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md md:max-w-lg',
    lg: 'max-w-lg md:max-w-xl lg:max-w-2xl',
    xl: 'max-w-xl md:max-w-2xl lg:max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default BaseModal;
```

**사용 예시**:
```tsx
// EventModal.tsx에서
<BaseModal isOpen={isOpen} onClose={onClose} size="lg">
  <div className="p-6">
    {/* 모달 내용 */}
  </div>
</BaseModal>
```

---

### 4. Responsive Table 패턴 개선

#### 현재 문제
출석부 테이블이 모바일에서 가로 스크롤 발생

#### 해결책: Card View 전환

```tsx
// components/Attendance/components/Table.tsx
const ResponsiveTable = ({ students, ... }) => {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // 모바일에서 자동으로 Card View 전환
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'card' : 'table');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (viewMode === 'card') {
    return (
      <div className="space-y-4 p-4">
        {students.map(student => (
          <div key={student.id} className="bg-white rounded-lg shadow p-4">
            <div className="font-bold text-lg mb-2">{student.name}</div>
            <div className="text-sm text-gray-600">{student.school} {student.grade}</div>
            <div className="grid grid-cols-7 gap-1 mt-3">
              {/* 요일별 출석 표시 */}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <TableView {...props} />;
};
```

---

### 5. Dynamic Import로 번들 크기 최적화

```tsx
// App.tsx
const CalendarBoard = lazy(() => import('./components/Calendar/CalendarBoard'));
const TimetableManager = lazy(() => import('./components/Timetable/TimetableManager'));
const AttendanceManager = lazy(() => import('./components/Attendance/AttendanceManager'));
const GanttManager = lazy(() => import('./components/Gantt/GanttManager'));
const ConsultationManager = lazy(() => import('./components/Consultation/ConsultationManager'));

// 사용 시
<Suspense fallback={<LoadingSpinner />}>
  {appMode === 'calendar' && <CalendarBoard {...props} />}
  {appMode === 'timetable' && <TimetableManager {...props} />}
  {/* ... */}
</Suspense>
```

---

## 반응형 디자인 가이드라인

### 권장 Breakpoints

프로젝트에서 사용할 표준 breakpoint:

```typescript
// constants/breakpoints.ts
export const BREAKPOINTS = {
  mobile: '(max-width: 639px)',      // < 640px
  tablet: '(min-width: 640px) and (max-width: 1023px)', // 640px - 1023px
  desktop: '(min-width: 1024px) and (max-width: 1439px)', // 1024px - 1439px
  large: '(min-width: 1440px)',      // >= 1440px
} as const;

// Tailwind에서는
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px
```

---

### 권장 패턴

#### 1. 너비 설정
```tsx
// ❌ 나쁜 예
<div className="w-[400px]">

// ✅ 좋은 예
<div className="w-full max-w-sm">           // 최대 384px
<div className="w-full max-w-md">           // 최대 448px
<div className="w-full max-w-lg">           // 최대 512px
<div className="w-full md:max-w-2xl">       // 모바일 전체, 데스크톱 최대 672px
```

#### 2. Overflow 처리
```tsx
// ❌ 나쁜 예
<div className="overflow-hidden">           // 콘텐츠 잘림

// ✅ 좋은 예
<div className="overflow-auto">             // 필요시 스크롤
<div className="overflow-y-auto overflow-x-hidden"> // 세로만 스크롤
<div className="overflow-x-auto">           // 테이블 등 가로 스크롤
```

#### 3. Flexbox 사용
```tsx
// ❌ 나쁜 예
<div className="flex">
  <div className="flex-1 min-w-[200px]">   // 고정 최소 너비

// ✅ 좋은 예
<div className="flex flex-col md:flex-row"> // 모바일 세로, 데스크톱 가로
  <div className="flex-1 min-w-0">         // 최소 너비 0으로 유연하게
  <div className="w-full md:w-1/2">        // 명시적 너비 지정
```

#### 4. Padding/Margin 반응형
```tsx
// ✅ 좋은 예
<div className="p-3 md:p-6 lg:p-8">        // 화면 크기별 다른 padding
<div className="space-y-2 md:space-y-4">   // 화면 크기별 간격
<div className="gap-2 md:gap-4">           // Flex/Grid gap도 반응형
```

#### 5. Typography 반응형
```tsx
// ✅ 좋은 예
<h1 className="text-xl md:text-2xl lg:text-3xl"> // 화면 크기별 폰트 크기
<p className="text-xs md:text-sm lg:text-base">  // 본문도 반응형
```

#### 6. Grid 레이아웃
```tsx
// ✅ 좋은 예
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 모바일 1열, 태블릿 2열, 데스크톱 3열 */}
</div>
```

#### 7. Sticky/Fixed 요소
```tsx
// ✅ 좋은 예
<div className="sticky top-0 z-30">          // 고정 위치
<div className="sticky top-[64px] md:top-[80px]"> // 반응형 위치
```

---

### Anti-Patterns (피해야 할 것)

```tsx
// ❌ 1. 고정 픽셀 너비
<div className="w-[500px]">

// ❌ 2. 과도한 최소 너비
<div className="min-w-[400px]">             // 모바일에서 문제

// ❌ 3. overflow-hidden 남용
<div className="overflow-hidden">           // 스크롤 불가

// ❌ 4. 고정 높이 without overflow
<div className="h-[500px]">                 // 콘텐츠 넘치면 잘림

// ❌ 5. 절대 위치 without 반응형 조정
<div className="absolute left-[200px]">     // 화면마다 깨짐

// ❌ 6. 고정 z-index 값 난발
<div className="z-[99999]">                 // 관리 어려움
```

---

### 테스트 체크리스트

반응형 디자인 수정 후 다음 해상도에서 테스트:

- [ ] **320px** - iPhone SE (최소 지원)
- [ ] **375px** - iPhone 12/13/14
- [ ] **390px** - iPhone 14 Pro
- [ ] **412px** - Android (Galaxy S21)
- [ ] **768px** - iPad (세로)
- [ ] **1024px** - iPad (가로) / 작은 노트북
- [ ] **1280px** - 일반 노트북
- [ ] **1440px** - 큰 모니터
- [ ] **1920px** - Full HD 모니터

**테스트 항목**:
1. 가로 스크롤 발생 여부
2. 텍스트 잘림 여부
3. 버튼/입력 요소 터치 가능 여부 (최소 44px)
4. 모달이 화면 밖으로 나가는지 확인
5. 테이블이 올바르게 스크롤되는지 확인
6. 헤더/푸터가 고정되어야 할 경우 올바르게 작동하는지

---

## 마이그레이션 전략

### 단계별 적용 계획

#### Phase 1: Critical Fixes (1일)
P0 수정 사항 적용
- App.tsx 메인 레이아웃
- CalendarBoard 최소 너비
- 모달 고정 너비 제거

#### Phase 2: High Priority (3일)
P1 수정 사항 적용
- 헤더 반응형 조정
- TimetableManager overflow
- 출석부 테이블 sticky header

#### Phase 3: Refactoring (1주)
- BaseModal 컴포넌트 생성
- CSS 변수 도입
- 공통 패턴 추출

#### Phase 4: Optimization (1주)
- 동적 import 적용
- 번들 크기 최적화
- 성능 측정 및 개선

---

## 성공 지표

수정 후 다음 지표로 개선 여부 확인:

1. **가로 스크롤 제거**: 모든 페이지에서 320px 이상에서 가로 스크롤 없음
2. **모달 접근성**: 모든 모달이 모바일에서 전체 표시
3. **테이블 사용성**: 출석부 테이블이 모바일에서 스크롤 가능
4. **콘텐츠 손실 없음**: overflow-hidden으로 인한 콘텐츠 잘림 제거
5. **Lighthouse 점수**: Mobile 점수 80+ 달성

---

## 추가 리소스

### 유용한 Tailwind 유틸리티

```tsx
// 1. 스크린 리더 전용 (시각적으로 숨김)
<div className="sr-only">Only for screen readers</div>

// 2. Aspect Ratio 유지
<div className="aspect-w-16 aspect-h-9">
  <iframe src="..." />
</div>

// 3. Truncate (말줄임)
<div className="truncate">Long text...</div>
<div className="line-clamp-2">Multi-line truncate...</div>

// 4. Safe Area (iOS Notch 대응)
<div className="pt-safe pb-safe">

// 5. Touch Target Size (최소 44px)
<button className="min-h-[44px] min-w-[44px]">
```

### Chrome DevTools 활용

1. **Device Mode**: Cmd+Shift+M (Mac) / Ctrl+Shift+M (Windows)
2. **Responsive Dimensions**: 커스텀 해상도로 테스트
3. **Lighthouse**: 성능 및 접근성 측정
4. **Coverage**: 미사용 CSS 확인

---

## 결론

ijw-calander 프로젝트의 반응형 디자인 문제는 **체계적인 접근**으로 해결 가능합니다.

**우선순위**:
1. P0 수정 사항 즉시 적용 (기능 손상 방지)
2. P1 수정 사항 이번 주 내 적용 (사용성 개선)
3. P2 리팩토링은 점진적으로 진행 (코드 품질)

**핵심 원칙**:
- 고정 너비 → 상대 너비 (w-full max-w-*)
- overflow-hidden → overflow-auto
- 모바일 우선 접근 (Mobile First)
- 일관된 breakpoint 사용

위 가이드라인을 따르면 **모든 해상도에서 최적의 사용자 경험**을 제공할 수 있습니다.

---

**문서 버전**: 1.0
**마지막 업데이트**: 2026-01-08
**담당자**: 리팩토링 전문가 에이전트
