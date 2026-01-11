# 타이포그래피 일관성 점검 보고서

**작성일**: 2026-01-11
**점검 범위**: components/, app/, hooks/, utils/

---

## 1. 요약

### 전체 현황
| 항목 | 수치 |
|------|------|
| 표준 Tailwind 글씨 크기 사용 | 1,294건 (97개 파일) |
| 커스텀 픽셀 크기 사용 | 약 400건 이상 |
| font-mono 사용 | 40건 |
| font-sans 사용 | 5건 |
| font-serif 사용 | 0건 |

### 주요 발견사항
1. **커스텀 픽셀 크기 과다 사용**: `text-[10px]`, `text-[9px]`, `text-[8px]` 등 비표준 크기 광범위 사용
2. **글씨체 설정 없음**: tailwind.config.js에 폰트 패밀리 미정의 (기본값 사용)
3. **일관성 있는 패턴**: 대부분의 컴포넌트에서 유사한 크기 패턴 사용

---

## 2. 글씨 크기 (Font Size) 분석

### 2.1 표준 Tailwind 클래스 사용 빈도

| 클래스 | 픽셀 크기 | 주요 용도 |
|--------|-----------|-----------|
| `text-xs` | 12px | 보조 텍스트, 레이블 |
| `text-sm` | 14px | 본문, 입력 필드 |
| `text-base` | 16px | 기본 본문 |
| `text-lg` | 18px | 섹션 제목 |
| `text-xl` | 20px | 모달 제목 |
| `text-2xl` | 24px | 페이지 제목 |

**총 사용 횟수**: 1,294건 (97개 파일)

### 2.2 커스텀 픽셀 크기 사용 현황

| 클래스 | 사용 빈도 | 주요 사용처 |
|--------|-----------|-------------|
| `text-[10px]` | 높음 | 배지, 태그, 작은 레이블 |
| `text-[9px]` | 중간 | 출결표, 시간표 셀 |
| `text-[8px]` | 중간 | 성적 뱃지, 매우 작은 정보 |
| `text-[11px]` | 낮음 | 버튼, 탭 |
| `text-[5px]~[6px]` | 낮음 | 연간 달력 뷰 (YearlyView) |

### 2.3 컴포넌트별 패턴

#### 시간표 (Timetable)
```
EnglishTeacherTab: text-[9px], text-[10px], text-xs
EnglishRoomTab: text-[9px], text-[10px], text-xs
TimetableGrid: text-[10px], text-xs
```

#### 출결 (Attendance)
```
Table.tsx: text-[8px], text-[9px], text-[10px] - 셀 밀도가 높아 작은 크기 사용
```

#### 달력 (Calendar)
```
CalendarBoard: text-[9px], text-[10px]
YearlyView: text-[5px], text-[6px], text-[8px] - 연간 뷰 공간 제약
EventModal: text-[10px], text-xs
```

---

## 3. 글씨체 (Font Family) 분석

### 3.1 현재 설정
```javascript
// tailwind.config.js
theme: {
  extend: {},  // 폰트 설정 없음 - 기본값 사용
}
```

### 3.2 사용 현황

| 클래스 | 사용 횟수 | 용도 |
|--------|-----------|------|
| `font-sans` | 5건 | 메인 레이아웃 컨테이너 |
| `font-mono` | 40건 | 숫자, 코드, 금액 표시 |
| `font-serif` | 0건 | 미사용 |

#### font-mono 주요 사용처
- **금액 표시**: PaymentReport, SettlementModal
- **날짜/시간**: Table.tsx, HolidaysTab
- **코드/로그**: ErrorBoundary, MigrationTab
- **강의실 번호**: EnglishTeacherTab

---

## 4. 폰트 굵기 (Font Weight) 분석

| 클래스 | 용도 |
|--------|------|
| `font-normal` | 일반 본문 |
| `font-medium` | 강조된 본문 |
| `font-bold` | 제목, 레이블 |
| `font-extrabold` | 강한 강조 (뱃지, 알림) |
| `font-black` | 매우 강한 강조 (드물게 사용) |

---

## 5. 문제점 및 권장사항

### 5.1 문제점

#### 1) 커스텀 픽셀 크기 과다 사용
- `text-[10px]`, `text-[9px]` 등이 광범위하게 사용됨
- Tailwind 표준 클래스로 대체 가능한 경우도 많음
- 유지보수 시 일관성 유지 어려움

#### 2) 폰트 패밀리 미정의
- tailwind.config.js에 커스텀 폰트 설정 없음
- 브라우저 기본 폰트에 의존
- 디자인 일관성 보장 어려움

#### 3) 반응형 크기 미적용
- 대부분 고정 크기 사용
- 모바일/데스크톱 간 크기 조정 부족

### 5.2 권장사항

#### 즉시 적용 가능 (낮은 위험도)

1. **tailwind.config.js에 폰트 설정 추가**
```javascript
theme: {
  extend: {
    fontFamily: {
      sans: ['Pretendard', 'Apple SD Gothic Neo', 'sans-serif'],
      mono: ['JetBrains Mono', 'Consolas', 'monospace'],
    },
    fontSize: {
      'xxs': ['10px', { lineHeight: '14px' }],
      'micro': ['9px', { lineHeight: '12px' }],
    },
  },
}
```

2. **커스텀 크기 표준화**
   - `text-[10px]` → `text-xxs` (커스텀 클래스)
   - `text-[9px]` → `text-micro` (커스텀 클래스)

#### 점진적 개선 (중간 위험도)

3. **컴포넌트별 리팩토링**
   - 각 도메인별로 일관된 크기 스케일 적용
   - 예: 시간표 = text-xxs/text-xs, 모달 = text-sm/text-base

4. **반응형 크기 적용**
```jsx
// Before
<span className="text-[10px]">라벨</span>

// After
<span className="text-[10px] sm:text-xs">라벨</span>
```

---

## 6. 컴포넌트별 상세 분석

### 6.1 가장 많은 커스텀 크기 사용 파일

| 파일 | 커스텀 크기 수 | 비고 |
|------|---------------|------|
| `Attendance/components/Table.tsx` | 15+ | 밀도 높은 테이블 |
| `Calendar/CalendarBoard.tsx` | 10+ | 이벤트 표시 |
| `Calendar/EventModal.tsx` | 8+ | 폼 레이블 |
| `Calendar/YearlyView.tsx` | 8+ | 연간 뷰 공간 제약 |
| `Timetable/English/EnglishTeacherTab.tsx` | 6+ | 시간표 셀 |

### 6.2 일관성 있는 파일

| 파일 | 특징 |
|------|------|
| `settings/*.tsx` | 대부분 text-xs, text-sm 표준 사용 |
| `Common/*.tsx` | 표준 Tailwind 클래스 준수 |
| `Auth/*.tsx` | 표준 Tailwind 클래스 준수 |

---

## 7. 액션 아이템

### 우선순위 높음
- [ ] tailwind.config.js에 폰트 패밀리 추가
- [ ] 커스텀 fontSize 클래스 정의 (xxs, micro)

### 우선순위 중간
- [ ] Table.tsx 리팩토링 (가장 많은 커스텀 크기 사용)
- [ ] YearlyView.tsx 반응형 크기 적용

### 우선순위 낮음
- [ ] 전체 컴포넌트 커스텀 크기 → 표준 클래스 마이그레이션
- [ ] 디자인 시스템 문서화

---

## 8. 결론

현재 코드베이스는 **기능적으로 일관성이 있으나**, 타이포그래피 표준화가 필요합니다:

1. **긍정적**: 각 도메인 내에서는 비교적 일관된 패턴 사용
2. **개선 필요**: 커스텀 픽셀 크기를 표준 클래스로 통일
3. **권장**: tailwind.config.js에 폰트 설정 추가로 디자인 일관성 강화

---

**보고서 작성자**: Claude (AI Assistant)
**검토 필요**: 디자인팀, 프론트엔드팀
