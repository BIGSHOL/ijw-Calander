# 반응형 디자인 빠른 참조 가이드

> ijw-calander 프로젝트 개발자를 위한 실용 가이드

---

## 즉시 사용 가능한 패턴

### 1. 모달 컴포넌트

```tsx
// ✅ 권장 패턴: 모든 화면 크기 대응
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
    {/* 모달 내용 */}
  </div>
</div>

// Size Variants:
// max-w-sm   (384px)  - 작은 알림, 확인 다이얼로그
// max-w-md   (448px)  - 간단한 폼
// max-w-lg   (512px)  - 일반 폼
// max-w-xl   (576px)  - 복잡한 폼
// max-w-2xl  (672px)  - 상세 정보, 넓은 테이블
// max-w-4xl  (896px)  - 전체 화면에 가까운 모달
```

---

### 2. 컨테이너 레이아웃

```tsx
// ✅ 메인 콘텐츠 영역
<main className="flex-1 flex flex-col md:flex-row overflow-auto">
  {/* 모바일: 세로 스택, 데스크톱: 가로 배치 */}
</main>

// ✅ 스크롤 가능한 섹션
<div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0">
  {/* 세로 스크롤, 가로 오버플로우 방지 */}
</div>

// ✅ 카드/패널
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-6">
  {/* 모바일 작은 패딩, 데스크톱 큰 패딩 */}
</div>
```

---

### 3. 테이블 반응형

```tsx
// ✅ 기본 반응형 테이블
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead>
      <tr>
        {/* Sticky 헤더 (선택사항) */}
        <th className="sticky top-0 bg-gray-50 p-2 md:p-3 text-xs md:text-sm">
          이름
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="p-2 md:p-3 text-xs md:text-sm">
          {/* 모바일에서 작은 텍스트 */}
        </td>
      </tr>
    </tbody>
  </table>
</div>

// ✅ Sticky Column (좌측 고정)
<th className="sticky left-0 z-20 bg-white p-2 md:p-3 min-w-[80px] md:min-w-[100px]">
  {/* 모바일에서 최소 너비 축소 */}
</th>
```

---

### 4. 폼 요소

```tsx
// ✅ 반응형 Input
<input
  type="text"
  className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border rounded-lg focus:outline-none focus:ring-2"
/>

// ✅ 버튼 (Touch Target 최소 44px)
<button className="px-4 md:px-6 py-2.5 md:py-3 min-h-[44px] text-sm md:text-base font-bold rounded-lg">
  클릭
</button>

// ✅ Select
<select className="w-full md:w-auto px-3 py-2 text-sm md:text-base border rounded-lg">
  <option>옵션</option>
</select>
```

---

### 5. 그리드 레이아웃

```tsx
// ✅ 반응형 그리드
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* 모바일: 1열, 태블릿: 2열, 데스크톱: 3-4열 */}
</div>

// ✅ 자동 피팅 그리드
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  {/* 컨테이너 크기에 따라 자동 조정 */}
</div>
```

---

### 6. Typography

```tsx
// ✅ 제목
<h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold">
  메인 제목
</h1>

// ✅ 본문
<p className="text-sm md:text-base leading-relaxed">
  본문 텍스트
</p>

// ✅ Truncate (말줄임)
<div className="truncate max-w-[200px] md:max-w-none">
  긴 텍스트가 잘립니다...
</div>

// ✅ Line Clamp (여러 줄 말줄임)
<div className="line-clamp-2 md:line-clamp-3">
  여러 줄 텍스트가 2줄(모바일) 또는 3줄(데스크톱)로 제한됩니다...
</div>
```

---

### 7. Spacing

```tsx
// ✅ Padding
<div className="p-3 md:p-6 lg:p-8">
  {/* 모바일 12px, 태블릿 24px, 데스크톱 32px */}
</div>

// ✅ Margin
<div className="mb-2 md:mb-4 lg:mb-6">
  {/* 아래 여백 반응형 */}
</div>

// ✅ Gap (Flexbox/Grid)
<div className="flex gap-2 md:gap-4 lg:gap-6">
  {/* 요소 간 간격 반응형 */}
</div>

// ✅ Space Between (자식 요소 간 간격)
<div className="space-y-2 md:space-y-4">
  <div>요소 1</div>
  <div>요소 2</div>
</div>
```

---

### 8. 네비게이션

```tsx
// ✅ 헤더
<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-14 md:h-16">
  <div className="flex items-center justify-between px-4 md:px-6 h-full">
    <div className="flex items-center gap-2 md:gap-4">
      {/* 로고 및 메뉴 */}
    </div>
  </div>
</header>

// ✅ 사이드바 (토글 가능)
<aside className={`
  fixed md:sticky top-0 left-0 h-full bg-white border-r
  transition-transform duration-300
  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
  md:translate-x-0
  w-64 md:w-72 z-40
`}>
  {/* 모바일: 오버레이 사이드바, 데스크톱: 항상 표시 */}
</aside>

// ✅ 하단 네비게이션 (모바일)
<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t h-16 flex justify-around items-center z-50">
  {/* 모바일에서만 표시 */}
</nav>
```

---

### 9. 이미지 및 미디어

```tsx
// ✅ 반응형 이미지
<img
  src={imageSrc}
  alt="설명"
  className="w-full h-auto rounded-lg"
/>

// ✅ Aspect Ratio 유지
<div className="aspect-w-16 aspect-h-9">
  <iframe src="https://youtube.com/..." className="w-full h-full" />
</div>

// ✅ Avatar (프로필 이미지)
<div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden">
  <img src={avatar} alt="User" className="w-full h-full object-cover" />
</div>
```

---

### 10. 조건부 표시/숨김

```tsx
// ✅ 화면 크기별 표시/숨김
<div className="hidden md:block">
  {/* 태블릿 이상에서만 표시 */}
</div>

<div className="md:hidden">
  {/* 모바일에서만 표시 */}
</div>

// ✅ 반응형 텍스트
<span className="hidden sm:inline">전체 텍스트</span>
<span className="sm:hidden">짧은 텍스트</span>
```

---

## 실전 예제

### 예제 1: 반응형 대시보드 카드

```tsx
const DashboardCard = ({ title, value, icon, change }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 border border-gray-200 hover:shadow-xl transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-1">
          {title}
        </h3>
        <p className="text-2xl md:text-3xl font-bold text-gray-900">
          {value}
        </p>
      </div>
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 flex items-center justify-center">
        {icon}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className={`text-xs md:text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {change >= 0 ? '+' : ''}{change}%
      </span>
      <span className="text-xs text-gray-500">전월 대비</span>
    </div>
  </div>
);
```

---

### 예제 2: 반응형 데이터 테이블 (Card View 전환)

```tsx
const ResponsiveTable = ({ data }) => {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

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
        {data.map(item => (
          <div key={item.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-lg">{item.name}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {item.status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">학교:</span>
                <span className="font-medium">{item.school}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">학년:</span>
                <span className="font-medium">{item.grade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">출석률:</span>
                <span className="font-medium text-green-600">{item.attendance}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left text-xs font-bold text-gray-700">이름</th>
            <th className="p-3 text-left text-xs font-bold text-gray-700">학교</th>
            <th className="p-3 text-left text-xs font-bold text-gray-700">학년</th>
            <th className="p-3 text-left text-xs font-bold text-gray-700">출석률</th>
            <th className="p-3 text-left text-xs font-bold text-gray-700">상태</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
              <td className="p-3 text-sm font-medium">{item.name}</td>
              <td className="p-3 text-sm text-gray-600">{item.school}</td>
              <td className="p-3 text-sm text-gray-600">{item.grade}</td>
              <td className="p-3 text-sm font-medium text-green-600">{item.attendance}%</td>
              <td className="p-3">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### 예제 3: 반응형 모달 (BaseModal 컴포넌트)

```tsx
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  title?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  title
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md md:max-w-lg',
    lg: 'max-w-lg md:max-w-xl lg:max-w-2xl',
    xl: 'max-w-xl md:max-w-2xl lg:max-w-4xl',
    full: 'max-w-full m-4',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        {title && (
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* 내용 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// 사용 예시
<BaseModal isOpen={isOpen} onClose={handleClose} size="lg" title="설정">
  <form className="space-y-4">
    {/* 폼 내용 */}
  </form>
</BaseModal>
```

---

### 예제 4: 반응형 캘린더 셀

```tsx
const CalendarCell = ({ date, events, onClick }) => (
  <div
    onClick={() => onClick(date)}
    className="
      min-h-[80px] md:min-h-[100px] lg:min-h-[120px]
      p-1 md:p-2
      border border-gray-200
      hover:bg-blue-50
      cursor-pointer
      transition-colors
      overflow-hidden
    "
  >
    {/* 날짜 */}
    <div className="text-xs md:text-sm font-bold text-gray-700 mb-1">
      {date.getDate()}
    </div>

    {/* 이벤트 (최대 3개 표시) */}
    <div className="space-y-0.5">
      {events.slice(0, 3).map(event => (
        <div
          key={event.id}
          className="
            text-[10px] md:text-xs
            px-1 md:px-2
            py-0.5 md:py-1
            rounded
            truncate
            font-medium
            bg-blue-100 text-blue-700
          "
        >
          {event.title}
        </div>
      ))}
      {events.length > 3 && (
        <div className="text-[10px] text-gray-500 text-center">
          +{events.length - 3}개 더보기
        </div>
      )}
    </div>
  </div>
);
```

---

## 디버깅 팁

### Chrome DevTools로 반응형 테스트

```javascript
// Console에서 현재 breakpoint 확인
const getCurrentBreakpoint = () => {
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
};

console.log('Current breakpoint:', getCurrentBreakpoint());

// 특정 요소의 크기 확인
const element = document.querySelector('.your-element');
console.log('Element size:', {
  width: element.offsetWidth,
  height: element.offsetHeight,
  scrollWidth: element.scrollWidth,
  scrollHeight: element.scrollHeight
});
```

---

### React Hook: useMediaQuery

```tsx
// hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// 사용 예시
const MyComponent = () => {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <div>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  );
};
```

---

## 체크리스트

새로운 컴포넌트 개발 시 다음을 확인하세요:

- [ ] 고정 픽셀 너비 사용하지 않음 (w-full max-w-* 사용)
- [ ] 모든 모달은 모바일에서 화면 안에 들어옴
- [ ] overflow-hidden 사용 시 스크롤 대안 제공
- [ ] 버튼/링크는 최소 44px 터치 영역 확보
- [ ] 텍스트는 반응형 크기 (text-sm md:text-base 등)
- [ ] Padding/Margin은 모바일에서 축소 (p-3 md:p-6 등)
- [ ] 테이블은 overflow-x-auto로 가로 스크롤 가능
- [ ] 320px, 375px, 768px, 1024px에서 테스트 완료
- [ ] 가로/세로 모드 모두 고려
- [ ] 브라우저 확대/축소 (50%-200%) 테스트

---

## 추가 리소스

- [Tailwind CSS 공식 문서 - Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN - Using Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries)
- [Google - Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [WebAIM - Target Size](https://webaim.org/articles/mobile/target-size)

---

**마지막 업데이트**: 2026-01-08
