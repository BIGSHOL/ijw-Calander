# 탭 헤더 디자인 시스템 규격

> 컴팩트하고 일관된 디자인을 위한 최소한의 규격

## 1. 탭 헤더 표준

### 기본 구조
```
높이: h-10 (40px)
배경: bg-[#081429] (어두운 네이비)
테두리: border-b border-white/10
패딩: px-4 (좌우 16px)
```

### 텍스트 규격
```
크기: text-xs (12px)
굵기: font-bold
색상 (활성): text-white
색상 (비활성): text-gray-400
```

### 버튼/필터 표준
```
패딩: px-3 py-1.5 (12px x 6px)
모서리: rounded-lg (8px)
텍스트: text-xs font-bold
간격: gap-2 (8px)
```

## 2. 색상 팔레트 (고정)

```css
주색상:   #081429  (어두운 네이비)
강조색:   #fdb813  (노란색)
부배경:   #1e293b  (슬레이트)

/* 버튼 상태 */
활성 배경:    bg-[#081429]
활성 텍스트:  text-white
비활성 텍스트: text-gray-400
호버:        hover:bg-white/10
```

## 3. 컴포넌트 규격

### A. 탭 버튼 (Tab Button)
```jsx
활성:   bg-[#081429] text-white border-[#fdb813] px-3 py-1.5 text-xs font-bold
비활성: text-gray-400 hover:text-gray-600 px-3 py-1.5 text-xs font-bold
```

### B. 액션 버튼 (Action Button)
```jsx
기본:   bg-[#fdb813] text-[#081429] px-3 py-1.5 text-xs font-bold rounded-lg
보조:   bg-gray-700 text-white px-3 py-1.5 text-xs font-bold rounded-lg
위험:   bg-red-600 text-white px-3 py-1.5 text-xs font-bold rounded-lg
```

### C. 검색/입력 필드
```jsx
패딩:    px-3 py-1.5
테두리:  border border-gray-200 rounded-lg
텍스트:  text-xs font-medium
포커스:  focus:ring-2 focus:ring-[#fdb813]/50
```

### D. 드롭다운/셀렉트 (기본)
```jsx
배경:    bg-[#1e293b]
테두리:  border border-gray-700 rounded-lg
패딩:    px-3 py-1.5
텍스트:  text-xs font-medium text-white
```

### E. 그리드 드롭다운 (6개 이상 옵션)
```jsx
컨테이너: grid grid-cols-3 sm:grid-cols-4 gap-1.5
아이템:   p-1.5 rounded border shadow-sm hover:shadow-md transition-shadow cursor-pointer
텍스트:   text-xs block truncate
```
**참고**: ClassSettingsModal.tsx:315 패턴

## 4. 아이콘 규격

```
크기: w-4 h-4 (16px) - 버튼 내부
간격: gap-1.5 (6px) - 아이콘과 텍스트 사이
```

## 5. 간격 규격

```
요소 간격:     gap-2 (8px)
섹션 간격:     gap-4 (16px)
헤더 내부 패딩: px-4 py-2.5 (16px x 10px)
```

## 6. 사용 금지 항목

❌ 절대 사용하지 말 것:
- `text-base` 이상의 큰 텍스트 (탭에서는)
- `px-6` 이상의 큰 패딩
- 커스텀 색상 (팔레트 외)
- `shadow-xl` 같은 큰 그림자

✅ 항상 사용할 것:
- `text-xs font-bold` (모든 탭/버튼)
- `px-3 py-1.5` (모든 버튼)
- `gap-2` (기본 간격)
- `rounded-lg` (모서리)

## 7. 반응형 규칙

현재 브레이크포인트:
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

**컴팩트 원칙**: 반응형은 최소한으로. 텍스트 숨김이나 아이콘만 표시 정도만.

## 8. 구현 우선순위

1단계: TabSubNavigation 컴포넌트 표준화
2단계: 모든 페이지가 TabSubNavigation 사용하도록 통일
3단계: 내부 children 요소들 규격 맞춤
