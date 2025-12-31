# 연간 뷰 버킷리스트 표시 개선

> **구현 완료**: 2025-12-31

## 목표
연간 뷰(YearlyView)에서 사용자가 특정 월을 선택하지 않아도, 해당 월에 버킷리스트 아이템이 존재하는지 직관적으로 확인할 수 있도록 개선합니다.

## 구현 결과

### 적용된 변경사항
| 파일 | 변경 내용 |
|------|-----------|
| `components/YearlyView.tsx` | `bucketCountByMonth` useMemo 훅 추가 (라인 155-163) |
| `components/YearlyView.tsx` | 월 카드 헤더에 버킷 표시기 UI 추가 (라인 222-253) |

### 주요 기능
- ✅ 깃발(Flag) 아이콘 + 개수 배지로 버킷리스트 존재 여부 표시
- ✅ 100개 이상일 때 "99+" 표시
- ✅ 선택/미선택 상태별 스타일 차별화 (투명도, 아이콘 크기)
- ✅ 접근성 속성 포함 (`role`, `aria-label`, `title`)

## 배경 및 동기

### 현재 문제점
- 사용자가 어떤 월에 버킷리스트가 있는지 확인하려면 각 월을 클릭하고 하단 패널을 스크롤해야 함
- 12개월 전체를 확인하려면 최소 12번의 클릭 필요
- 연간 계획 수립 시 비효율적인 워크플로우

### 해결 방안
각 월 카드 헤더에 버킷리스트 존재 여부 및 개수를 시각적으로 표시하여 한눈에 파악 가능하도록 개선

## 구현 상세

### 대상 파일
- `components/YearlyView.tsx`

### 단계 1: 월별 버킷리스트 카운트 맵 생성 (성능 최적화)

**위치**: YearlyView.tsx 약 155줄 (다른 useMemo 훅들 다음)

**문제점**: 각 월마다 `filter` 실행 시 O(n*12) 복잡도로 성능 저하 발생

**해결 방안**: `useMemo`로 월별 카운트 맵을 사전 계산 (O(n + 12))

```typescript
// 월별 버킷리스트 카운트 맵 (성능 최적화)
const bucketCountByMonth = useMemo(() => {
  const countMap: Record<string, number> = {};
  bucketItems.forEach(bucket => {
    const month = bucket.targetMonth; // 'YYYY-MM' format
    countMap[month] = (countMap[month] || 0) + 1;
  });
  return countMap;
}, [bucketItems]);
```

### 단계 2: 월 카드 헤더에 버킷 표시기 추가

**위치**: YearlyView.tsx 약 212-217줄 (월 카드 헤더 부분)

**기존 코드**:
```tsx
<div className="flex justify-between items-center mb-1 sm:mb-1.5">
    <h3 className={`text-[10px] sm:text-xs lg:text-sm font-bold ${isSelected ? 'text-[#081429]' : 'text-gray-600'}`}>
        {format(month, 'M월')}
    </h3>
    {isSelected && <span className="text-[6px] sm:text-[8px] px-1 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#fdb813', color: '#081429' }}>선택됨</span>}
</div>
```

**변경 후 코드**:
```tsx
<div className="flex justify-between items-center mb-1 sm:mb-1.5">
    <h3 className={`text-[10px] sm:text-xs lg:text-sm font-bold ${isSelected ? 'text-[#081429]' : 'text-gray-600'}`}>
        {format(month, 'M월')}
    </h3>

    {/* 우측 배지 영역 */}
    <div className="flex gap-1 items-center">
        {/* 버킷 표시기 */}
        {(() => {
            const bucketCount = bucketCountByMonth[format(month, 'yyyy-MM')] || 0;
            if (bucketCount === 0) return null;

            const displayCount = bucketCount > 99 ? '99+' : bucketCount;

            return (
                <div
                    className="flex items-center gap-0.5 text-[8px] sm:text-[10px] lg:text-xs px-1 sm:px-1.5 lg:px-2 py-0.5 rounded-full font-bold transition-all"
                    style={{
                        backgroundColor: isSelected ? '#fdb813' : '#fdb81380',
                        color: '#081429'
                    }}
                    role="status"
                    aria-label={`${format(month, 'M월')}에 ${bucketCount}개의 버킷리스트 항목`}
                    title={`${bucketCount}개의 버킷리스트`}
                >
                    <Flag size={isSelected ? 10 : 8} strokeWidth={2.5} aria-hidden="true" />
                    <span>{displayCount}</span>
                </div>
            );
        })()}

        {/* 기존 "선택됨" 배지 */}
        {isSelected && (
            <span
                className="text-[6px] sm:text-[8px] px-1 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: '#fdb813', color: '#081429' }}
            >
                선택됨
            </span>
        )}
    </div>
</div>
```

## 엣지 케이스 및 예외 처리

### 버킷 개수별 처리
| 개수 | 표시 방법 | 이유 |
|------|-----------|------|
| 0개 | 표시 안 함 | 시각적 노이즈 감소 |
| 1-99개 | 아이콘 + 숫자 | 정확한 개수 전달 |
| 100개 이상 | 아이콘 + "99+" | 공간 절약 |

### 선택 상태별 스타일
| 상태 | 배경색 | 투명도 | 아이콘 크기 |
|------|--------|--------|-------------|
| 미선택 | #fdb813 | 80% | 8px |
| 선택 | #fdb813 | 100% | 10px |

### 접근성 (Accessibility)
- `role="status"`: 동적 콘텐츠 알림
- `aria-label`: 스크린 리더용 설명 제공
- `title`: 호버 시 툴팁 표시
- `aria-hidden="true"`: 아이콘은 장식용으로 표시
- 색상뿐만 아니라 아이콘과 텍스트를 함께 사용하여 색맹 사용자 고려

## 테스트 가이드

### 테스트 환경 준비
1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 앱 접속
3. 로그인하여 연간 뷰(YearlyView)로 이동
4. 브라우저 개발자 도구 준비 (F12)
   - React DevTools 설치 권장
   - Lighthouse 또는 axe DevTools 준비 (접근성 테스트용)

---

## A. 수동 테스트 (Manual Testing)

### A1. 기능 테스트 - CRITICAL (필수)

#### A1.1 버킷 추가 시 표시기 나타남
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 연간 뷰에서 현재 버킷이 없는 월(예: 2025년 3월)을 선택
2. 하단 "버킷리스트 추가" 버튼 클릭
3. 버킷 아이템 입력 (예: "책 10권 읽기")
4. 추가 완료 후 연간 뷰로 돌아와 3월 카드 확인

**예상 결과**:
- ✅ 3월 카드 우측 상단에 깃발 아이콘 + "1" 배지 표시
- ✅ 배지 색상: 선택된 월이면 `#fdb813` (100%), 미선택이면 `#fdb81380` (80% 투명도)
- ✅ 깃발 아이콘 크기: 선택됨 10px, 미선택 8px
- ✅ 애니메이션 부드럽게 나타남 (`transition-all`)

**실패 시 확인사항**:
- `bucketCountByMonth` useMemo가 `bucketItems` 변경 감지하는지 확인
- 버킷의 `targetMonth` 필드가 'YYYY-MM' 포맷인지 확인

---

#### A1.2 버킷 삭제 시 카운트 감소
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 버킷이 3개 있는 월(예: 2025년 5월) 선택
2. 월 카드에 "🚩 3" 표시 확인
3. 버킷 하나 삭제
4. 카운트 변화 즉시 확인

**예상 결과**:
- ✅ 카운트가 3 → 2로 즉시 업데이트
- ✅ 깜빡임 없이 부드럽게 변경
- ✅ 배지 위치 변화 없음

**실패 시 확인사항**:
- `bucketItems` 배열이 제대로 업데이트되는지
- React 상태 업데이트가 정상적으로 트리거되는지

---

#### A1.3 마지막 버킷 삭제 시 표시기 사라짐
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 버킷이 정확히 1개만 있는 월 선택
2. 월 카드에 "🚩 1" 표시 확인
3. 해당 버킷 삭제
4. 표시기 사라짐 확인

**예상 결과**:
- ✅ 표시기 완전히 사라짐 (null 반환)
- ✅ "선택됨" 배지는 그대로 유지
- ✅ 레이아웃 깨짐 없음

**실패 시 확인사항**:
- `if (bucketCount === 0) return null;` 로직 동작 확인
- 조건부 렌더링이 제대로 작동하는지

---

#### A1.4 100개 이상일 때 "99+" 표시
**우선순위**: 🟡 NICE TO TEST (엣지 케이스)

**테스트 단계**:
1. 개발자 도구 콘솔에서 임시로 많은 버킷 생성
   ```javascript
   // 콘솔에서 실행 (임시 테스트용)
   // 주의: 실제 데이터 생성 로직에 맞게 수정 필요
   for(let i = 0; i < 105; i++) {
     // 버킷 추가 함수 호출
   }
   ```
2. 또는 코드에서 임시로 `bucketCount` 값을 100으로 하드코딩
   ```typescript
   const bucketCount = 100; // 테스트용
   ```
3. 연간 뷰에서 해당 월 확인

**예상 결과**:
- ✅ "🚩 99+" 표시 (정확한 숫자 대신)
- ✅ 배지 레이아웃 깨지지 않음
- ✅ 호버 시 툴팁에는 정확한 개수 표시 (예: "105개의 버킷리스트")

**실패 시 확인사항**:
- `const displayCount = bucketCount > 99 ? '99+' : bucketCount;` 로직 확인
- `title` 속성에는 실제 개수 표시되는지 확인

---

### A2. UI/UX 테스트 - HIGH (필수)

#### A2.1 "선택됨" 배지와 함께 표시 시 레이아웃
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 버킷이 있는 월 선택 (선택됨 배지 + 버킷 표시기 동시 표시)
2. 월 카드 헤더 우측 영역 확인
3. 다른 월 선택하여 미선택 상태 확인

**예상 결과**:
- ✅ 두 배지가 `gap-1` 간격으로 수평 나열
- ✅ 배지들이 겹치거나 줄바꿈되지 않음
- ✅ 선택 상태 전환 시 레이아웃 유지
- ✅ 버킷 표시기가 왼쪽, "선택됨"이 오른쪽에 위치

**시각적 체크**:
```
┌─────────────────────────┐
│ 3월      [🚩 5] [선택됨] │  ← 이렇게 정렬
└─────────────────────────┘
```

**실패 시 확인사항**:
- Flexbox `gap-1` 적용 확인
- 부모 컨테이너의 `justify-between` 확인

---

#### A2.2 반응형 디자인 (모바일/태블릿/데스크톱)
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 개발자 도구에서 다음 뷰포트로 테스트:
   - 📱 **모바일**: 375px × 667px (iPhone SE)
   - 📱 **태블릿**: 768px × 1024px (iPad)
   - 🖥️ **데스크톱**: 1920px × 1080px

2. 각 뷰포트에서 확인할 항목:
   - 버킷 표시기 크기 조정
   - 텍스트 크기
   - 아이콘 크기
   - 간격

**예상 결과**:

| 디바이스 | 텍스트 크기 | 아이콘 크기 (선택됨) | 패딩 |
|---------|------------|---------------------|------|
| 모바일 (sm 이하) | `text-[8px]` | 10px | `px-1` |
| 태블릿 (sm) | `text-[10px]` | 10px | `px-1.5` |
| 데스크톱 (lg) | `text-xs` | 10px | `px-2` |

- ✅ 모든 화면에서 배지 가독성 유지
- ✅ 텍스트 잘림 현상 없음
- ✅ 터치 영역 충분 (모바일에서 최소 44×44px 권장)

**실패 시 확인사항**:
- Tailwind breakpoint 클래스 적용 확인 (`sm:`, `lg:`)
- 폰트 크기가 너무 작지 않은지 (최소 8px 이상)

---

#### A2.3 선택/미선택 상태에서 색상 대비
**우선순위**: 🔴 MUST TEST

**테스트 단계**:
1. 버킷이 있는 월을 선택하여 표시기 색상 확인
2. 다른 월을 선택하여 이전 월이 미선택 상태가 되도록 함
3. 두 상태의 시각적 차이 확인

**예상 결과**:

| 상태 | 배경색 | 투명도 | 아이콘 크기 | 시각적 효과 |
|------|--------|--------|-------------|------------|
| **선택됨** | `#fdb813` | 100% | 10px | 강조, 더 밝고 큼 |
| **미선택** | `#fdb813` | 80% (`#fdb81380`) | 8px | 부드럽고 차분함 |

- ✅ 선택된 월의 표시기가 더 눈에 띄어야 함
- ✅ 미선택 월도 충분히 가독 가능
- ✅ 색상 전환이 자연스러움 (`transition-all`)

**실패 시 확인사항**:
- `isSelected` prop이 정확히 전달되는지
- 동적 스타일 객체가 올바른지

---

### A3. 접근성 테스트 - HIGH (필수)

#### A3.1 스크린 리더 테스트
**우선순위**: 🟡 NICE TO TEST (접근성 중요하지만 환경 필요)

**테스트 환경**:
- **Windows**: NVDA (무료) 또는 JAWS
- **macOS**: VoiceOver (내장)
- **Chrome**: ChromeVox 확장

**테스트 단계**:
1. 스크린 리더 활성화
2. 연간 뷰로 이동
3. Tab 키로 월 카드들 탐색
4. 버킷 표시기에 포커스 시 읽기 내용 확인

**예상 결과**:
- ✅ 스크린 리더가 읽는 내용: "3월에 5개의 버킷리스트 항목, 상태"
- ✅ `role="status"`로 인해 동적 변경 시 알림
- ✅ 아이콘은 `aria-hidden="true"`로 중복 읽기 방지

**실패 시 확인사항**:
- `aria-label` 속성 값 확인
- `role` 속성 확인

---

#### A3.2 색상 대비 검증 (WCAG 2.1 AA 기준)
**우선순위**: 🔴 MUST TEST

**테스트 도구**:
- **Chrome DevTools Lighthouse** (접근성 탭)
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **axe DevTools** (확장 프로그램)

**테스트 단계**:
1. Chrome DevTools → Lighthouse → "Accessibility" 체크 → 보고서 생성
2. 또는 WebAIM Contrast Checker에 색상 입력:
   - **전경색 (텍스트)**: `#081429` (어두운 네이비)
   - **배경색 (선택)**: `#fdb813` (노란색)
   - **배경색 (미선택)**: `#fdb81380` (80% 투명도 노란색)

**예상 결과**:
- ✅ **대비율 4.5:1 이상** (WCAG AA 기준 일반 텍스트)
- ✅ 작은 텍스트(8px)는 7:1 이상 권장
- ✅ Lighthouse 접근성 점수 90점 이상

**실패 시 확인사항**:
- 색상 조합 변경 필요 시 디자이너와 협의
- 폰트 두께(`font-bold`) 유지로 가독성 보완

---

#### A3.3 호버 툴팁 동작 확인
**우선순위**: 🟡 NICE TO TEST

**테스트 단계**:
1. 마우스를 버킷 표시기 위에 올림 (호버)
2. 툴팁 내용 확인
3. 여러 개수의 버킷에서 테스트 (1개, 50개, 100개 이상)

**예상 결과**:
- ✅ 호버 시 툴팁 표시: "5개의 버킷리스트"
- ✅ 100개 이상일 때도 정확한 개수 표시: "105개의 버킷리스트"
- ✅ 툴팁이 표시기를 가리지 않음

**실패 시 확인사항**:
- `title` 속성 값 확인
- 브라우저별 기본 툴팁 스타일 차이 (정상)

---

## B. 자동화된 테스트 (Automated Testing)

### B1. 성능 테스트 - MEDIUM (권장)

#### B1.1 버킷 100개 이상일 때 렌더링 성능
**우선순위**: 🟡 NICE TO TEST

**테스트 도구**:
- Chrome DevTools → Performance 탭
- React DevTools → Profiler 탭

**테스트 단계**:
1. 테스트 데이터 생성 (100개 이상의 버킷)
   ```typescript
   // 개발 환경에서 임시 Mock 데이터 생성
   const mockBuckets = Array.from({ length: 150 }, (_, i) => ({
     id: `test-${i}`,
     title: `버킷 ${i}`,
     targetMonth: '2025-03',
     // 기타 필드...
   }));
   ```

2. Chrome DevTools Performance 기록:
   - Performance 탭 열기 → Record 시작
   - 연간 뷰 렌더링
   - 다른 월 선택하여 리렌더링 트리거
   - Record 중지

3. 결과 분석:
   - Scripting (JavaScript 실행 시간)
   - Rendering (레이아웃 계산)
   - Painting (화면 그리기)

**예상 결과**:
- ✅ 첫 렌더링: **< 100ms**
- ✅ 리렌더링: **< 50ms**
- ✅ 프레임 드롭 없음 (60fps 유지)
- ✅ `bucketCountByMonth` useMemo 덕분에 O(n + 12) 복잡도

**성능 기준**:
| 항목 | 목표 | 경고 | 실패 |
|------|------|------|------|
| 첫 렌더링 | < 100ms | 100-200ms | > 200ms |
| 리렌더링 | < 50ms | 50-100ms | > 100ms |
| 메모리 증가 | < 5MB | 5-10MB | > 10MB |

**실패 시 확인사항**:
- `useMemo` 의존성 배열 확인
- 불필요한 리렌더링 발생 여부
- React.memo 적용 고려

---

#### B1.2 React DevTools Profiler로 리렌더링 측정
**우선순위**: 🟡 NICE TO TEST

**테스트 단계**:
1. React DevTools → Profiler 탭 열기
2. Record 버튼 클릭
3. 다음 동작 수행:
   - 버킷 추가
   - 버킷 삭제
   - 월 선택 변경
4. Record 중지 후 Flame Graph 확인

**예상 결과**:
- ✅ `YearlyView` 컴포넌트만 리렌더링 (하위 월 카드는 최소화)
- ✅ `bucketCountByMonth` 계산은 `bucketItems` 변경 시에만 실행
- ✅ 불필요한 전체 트리 리렌더링 없음

**Profiler 읽는 법**:
- **노란색/빨간색 바**: 렌더링 시간이 긴 컴포넌트 (최적화 필요)
- **회색 바**: 렌더링 스킵됨 (좋음)
- **Committed at**: 커밋 시간 확인

**실패 시 확인사항**:
- 월 카드 컴포넌트에 React.memo 적용 고려
- Props 비교 함수 최적화

---

### B2. 단위 테스트 (Unit Tests) - 선택 사항

#### B2.1 `bucketCountByMonth` 로직 테스트
**우선순위**: 🟢 OPTIONAL (시간 있을 때)

**테스트 파일**: `YearlyView.test.tsx`

**테스트 코드 예시**:
```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useMemo } from 'react';

describe('bucketCountByMonth', () => {
  it('should count buckets by month correctly', () => {
    const bucketItems = [
      { id: '1', targetMonth: '2025-03', title: 'Bucket 1' },
      { id: '2', targetMonth: '2025-03', title: 'Bucket 2' },
      { id: '3', targetMonth: '2025-05', title: 'Bucket 3' },
    ];

    const { result } = renderHook(() =>
      useMemo(() => {
        const countMap: Record<string, number> = {};
        bucketItems.forEach(bucket => {
          const month = bucket.targetMonth;
          countMap[month] = (countMap[month] || 0) + 1;
        });
        return countMap;
      }, [bucketItems])
    );

    expect(result.current).toEqual({
      '2025-03': 2,
      '2025-05': 1,
    });
  });

  it('should return empty object for no buckets', () => {
    const bucketItems = [];
    // 테스트 로직...
    expect(result.current).toEqual({});
  });

  it('should handle 100+ buckets in same month', () => {
    const bucketItems = Array.from({ length: 105 }, (_, i) => ({
      id: `${i}`,
      targetMonth: '2025-12',
      title: `Bucket ${i}`,
    }));
    // 테스트 로직...
    expect(result.current['2025-12']).toBe(105);
  });
});
```

---

## 테스트 체크리스트 요약

### 🔴 CRITICAL - 반드시 테스트 (릴리스 전 필수)
- [ ] A1.1: 버킷 추가 시 표시기 나타남
- [ ] A1.2: 버킷 삭제 시 카운트 감소
- [ ] A1.3: 마지막 버킷 삭제 시 표시기 사라짐
- [ ] A2.1: "선택됨" 배지와 함께 표시 시 레이아웃
- [ ] A2.2: 반응형 디자인 (모바일/태블릿/데스크톱)
- [ ] A2.3: 선택/미선택 상태에서 색상 대비
- [ ] A3.2: 색상 대비 검증 (WCAG 2.1 AA)

### 🟡 HIGH - 권장 테스트 (중요하지만 상황에 따라 조정)
- [ ] A1.4: 100개 이상일 때 "99+" 표시
- [ ] A3.1: 스크린 리더 테스트
- [ ] A3.3: 호버 툴팁 동작 확인
- [ ] B1.1: 버킷 100개 이상일 때 렌더링 성능
- [ ] B1.2: React DevTools Profiler로 리렌더링 측정

### 🟢 NICE TO HAVE - 선택 테스트 (시간 여유 있을 때)
- [ ] B2.1: `bucketCountByMonth` 로직 단위 테스트
- [ ] 크로스 브라우저 테스트 (Chrome, Firefox, Safari)
- [ ] 다크모드 대응 확인 (있는 경우)

---

## 테스트 결과 보고 양식

테스트 완료 후 다음 형식으로 결과를 기록하세요:

```markdown
### 테스트 실행 일시
- 날짜: YYYY-MM-DD
- 테스터: [이름]
- 환경: [OS, 브라우저, 디바이스]

### 테스트 결과

#### ✅ 통과한 테스트
- A1.1: 버킷 추가 시 표시기 정상 동작 확인
- A2.2: 모든 뷰포트에서 반응형 정상

#### ❌ 실패한 테스트
- A3.2: 색상 대비율 4.2:1 (기준 4.5:1 미달)
  - **원인**: 80% 투명도 배경에서 대비 부족
  - **조치**: 투명도를 85%로 조정 필요

#### ⚠️ 부분 통과 / 주의사항
- B1.1: 성능은 기준 내이나 150개 이상에서 약간의 지연 감지
  - **조치**: 현재는 문제없으나 모니터링 필요

### 스크린샷
[관련 스크린샷 첨부]

### 권장 조치 사항
1. 색상 대비 개선
2. 성능 모니터링 설정
```

---

## 기대 효과
- 사용자가 연간 일정을 조망할 때, 달성해야 할 목표(버킷리스트)가 있는 월을 한눈에 파악 가능
- 월별 계획 수립 워크플로우 개선 및 클릭 수 감소
- 접근성 향상으로 모든 사용자에게 동등한 사용 경험 제공
