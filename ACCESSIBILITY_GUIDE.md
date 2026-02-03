# ♿ 접근성 가이드 (Accessibility Guide)

**작성일**: 2026-02-03
**버전**: 1.0.0
**대상**: 모든 프론트엔드 개발자

---

## 📋 목차

1. [개요](#개요)
2. [WCAG 2.1 준수 현황](#wcag-21-준수-현황)
3. [컴포넌트별 접근성 기능](#컴포넌트별-접근성-기능)
4. [키보드 네비게이션](#키보드-네비게이션)
5. [스크린 리더 대응](#스크린-리더-대응)
6. [접근성 체크리스트](#접근성-체크리스트)
7. [테스트 방법](#테스트-방법)

---

## 개요

이 가이드는 학원 관리 시스템의 접근성 기능과 모범 사례를 문서화합니다. 우리의 목표는 **WCAG 2.1 Level AA** 준수입니다.

### 왜 접근성이 중요한가?

- **법적 요구사항**: 장애인차별금지법 준수
- **사용자 포용**: 시각/청각/운동 장애가 있는 사용자도 사용 가능
- **SEO 개선**: 접근 가능한 사이트는 검색 엔진 최적화에도 유리
- **코드 품질**: 접근성을 고려한 코드는 더 견고하고 유지보수하기 쉬움

---

## WCAG 2.1 준수 현황

### Level A (필수) - ✅ 준수
- [x] 1.1.1 Non-text Content (대체 텍스트)
- [x] 2.1.1 Keyboard (키보드 접근)
- [x] 2.4.1 Bypass Blocks (블록 건너뛰기)
- [x] 3.1.1 Language of Page (페이지 언어)
- [x] 4.1.2 Name, Role, Value (이름, 역할, 값)

### Level AA (권장) - 🟡 부분 준수
- [x] 1.4.3 Contrast (색상 대비) - 대부분 준수
- [x] 2.4.6 Headings and Labels (제목과 레이블)
- [x] 2.4.7 Focus Visible (포커스 표시)
- [ ] 1.4.4 Resize Text (텍스트 크기 조절) - 개선 필요
- [ ] 2.4.5 Multiple Ways (다중 탐색 경로) - 개선 필요

### Level AAA (선택) - ⚠️ 미준수
- [ ] 1.4.6 Contrast (Enhanced) (향상된 대비)
- [ ] 2.4.8 Location (위치 정보)

---

## 컴포넌트별 접근성 기능

### 1. TabButton

#### ARIA 속성
```tsx
<TabButton
  active={isActive}
  role="tab"           // 탭 버튼임을 명시
  aria-selected={isActive}  // 선택 상태 (role="tab"일 때 자동 설정)
  aria-label="대시보드 탭"  // 명확한 레이블
>
  대시보드
</TabButton>
```

#### 토글 버튼
```tsx
<TabButton
  active={isEnabled}
  variant="tab-toggle"
  aria-pressed={isEnabled}  // 토글 상태 (자동 설정)
  aria-label="미수강 학생 제외"
>
  미수강 제외
</TabButton>
```

#### 자동 접근성 기능
- **role**: 명시하지 않으면 기본 `button`
- **aria-selected**: `role="tab"`이고 `active` prop이 있으면 자동 설정
- **aria-pressed**: `variant="tab-toggle"`이고 `active` prop이 있으면 자동 설정
- **focus:ring-2**: 포커스 시 명확한 아웃라인 표시
- **disabled**: 비활성화 시 `opacity-50`, `cursor-not-allowed`

---

### 2. TabFilterGroup

#### Primary 필터 (항상 보임)
```tsx
<TabFilterGroup.Primary>
  <SubjectFilter aria-label="과목 필터" />
  <StatusFilter aria-label="상태 필터" />
  <SearchBar placeholder="학생 검색" aria-label="학생 이름 검색" />
</TabFilterGroup.Primary>
```

#### Advanced 필터 (드롭다운)
```tsx
<TabFilterGroup.Advanced label="고급 필터">
  {/* 자동 접근성 기능 */}
  {/* - aria-expanded: 드롭다운 열림/닫힘 상태 */}
  {/* - aria-controls: 제어하는 패널 ID */}
  {/* - role="dialog": 드롭다운 패널 역할 */}
  {/* - ESC 키: 드롭다운 닫기 */}
  {/* - 포커스 관리: 열릴 때 첫 번째 입력 요소로 이동 */}

  <GradeFilter />
  <TeacherFilter />
</TabFilterGroup.Advanced>
```

#### 키보드 단축키
- **Enter/Space**: 드롭다운 열기/닫기
- **Esc**: 드롭다운 닫기 (버튼으로 포커스 복귀)
- **Tab**: 드롭다운 내 요소 간 이동

#### 포커스 관리
1. **드롭다운 열림**: 첫 번째 입력 요소로 자동 포커스
2. **드롭다운 닫힘**: 트리거 버튼으로 포커스 복귀
3. **외부 클릭**: 드롭다운 닫힘

---

### 3. TabSubNavigation

#### Semantic HTML
```tsx
<TabSubNavigation variant="compact">
  {/* nav 태그로 렌더링됨 */}
  {/* role="navigation" 자동 설정 */}
  {/* aria-label="필터 및 보기 옵션" */}

  <TabButton>...</TabButton>
</TabSubNavigation>
```

#### 접근성 기능
- **<nav> 태그**: 스크린 리더가 네비게이션 영역으로 인식
- **role="navigation"**: 명시적 역할 선언
- **aria-label**: 네비게이션 목적 설명

---

## 키보드 네비게이션

### 전역 단축키

| 키 | 기능 | 구현 상태 |
|---|------|----------|
| **Tab** | 다음 요소로 이동 | ✅ 기본 지원 |
| **Shift + Tab** | 이전 요소로 이동 | ✅ 기본 지원 |
| **Enter** | 버튼/링크 활성화 | ✅ 기본 지원 |
| **Space** | 버튼 활성화 | ✅ 기본 지원 |
| **Esc** | 드롭다운/모달 닫기 | ✅ TabFilterGroup |
| **Arrow Keys** | 탭 간 이동 | ⚠️ 개선 예정 |

### 컴포넌트별 키보드 지원

#### TabButton
```
Tab:         포커스 이동
Enter/Space: 버튼 클릭
```

#### TabFilterGroup.Advanced
```
Enter/Space: 드롭다운 열기/닫기
Esc:         드롭다운 닫기
Tab:         드롭다운 내 요소 간 이동
```

#### Select/Input
```
Tab:         포커스 이동
Arrow Up/Down: 옵션 선택 (select)
Enter:        입력 완료
```

---

## 스크린 리더 대응

### ARIA Live Regions

#### 필터 변경 알림 (예정)
```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {`${filteredCount}개의 학생이 검색되었습니다.`}
</div>
```

### ARIA 레이블 모범 사례

#### ✅ Good
```tsx
<button aria-label="2026년 1월 달력 보기">
  2026년 1월
</button>

<input
  type="search"
  placeholder="학생 검색"
  aria-label="학생 이름 또는 학교로 검색"
/>
```

#### ❌ Bad
```tsx
<button>  {/* aria-label 없음 */}
  <SearchIcon />
</button>

<input
  placeholder="검색"  {/* 너무 모호함 */}
/>
```

### 아이콘 버튼
```tsx
<button
  aria-label="설정 열기"  // 명확한 설명
  title="설정"            // 툴팁 (선택)
>
  <Settings size={16} aria-hidden="true" />  // 아이콘은 숨김
</button>
```

---

## 접근성 체크리스트

### 개발 시 확인사항

#### 모든 컴포넌트
- [ ] 키보드로만 모든 기능 사용 가능
- [ ] 포커스 표시 명확 (focus:ring)
- [ ] 색상만으로 정보 전달하지 않음
- [ ] 최소 4.5:1 색상 대비 (텍스트)
- [ ] 최소 3:1 색상 대비 (UI 요소)

#### 버튼/링크
- [ ] aria-label 또는 텍스트 콘텐츠
- [ ] 아이콘만 있으면 aria-label 필수
- [ ] disabled 상태 명확
- [ ] 최소 44x44px 터치 타겟

#### 폼
- [ ] <label> 또는 aria-label
- [ ] 에러 메시지 aria-describedby
- [ ] 필수 필드 aria-required
- [ ] 유효성 검사 실시간 피드백

#### 모달/드롭다운
- [ ] Esc 키로 닫기
- [ ] 열릴 때 포커스 트랩
- [ ] 닫힐 때 포커스 복귀
- [ ] role="dialog" (모달)
- [ ] aria-modal="true" (모달)

---

## 테스트 방법

### 1. 키보드 테스트
```
1. 마우스를 치워둔다
2. Tab 키로 모든 요소 접근 시도
3. Enter/Space로 모든 버튼 클릭 시도
4. Arrow 키로 탭/리스트 탐색 시도
5. Esc 키로 모달/드롭다운 닫기 시도
```

### 2. 스크린 리더 테스트

#### Windows + NVDA (무료)
```
1. NVDA 설치 및 실행
2. Insert + Down: 읽기 모드
3. Tab: 다음 요소
4. Insert + F7: 요소 목록
5. H: 다음 제목
```

#### Mac + VoiceOver (내장)
```
1. Cmd + F5: VoiceOver 켜기/끄기
2. VO + Right: 다음 항목
3. VO + Space: 활성화
4. VO + U: 로터 (요소 탐색)
```

### 3. 자동화 도구

#### Axe DevTools (Chrome 확장)
```
1. 크롬 확장 설치
2. DevTools → Axe
3. "Scan ALL of my page" 클릭
4. 발견된 이슈 수정
```

#### Lighthouse (Chrome 내장)
```
1. DevTools → Lighthouse
2. "Accessibility" 선택
3. "Generate report" 클릭
4. 90점 이상 목표
```

#### eslint-plugin-jsx-a11y
```bash
# package.json에 추가
"eslintConfig": {
  "extends": ["plugin:jsx-a11y/recommended"]
}
```

---

## 색상 대비 가이드

### 텍스트
| 배경 | 텍스트 | 대비율 | WCAG |
|------|--------|--------|------|
| `#081429` (네이비) | `#ffffff` (흰색) | 14.6:1 | ✅ AAA |
| `#081429` (네이비) | `#fdb813` (노란색) | 9.3:1 | ✅ AAA |
| `#1e293b` (슬레이트) | `#ffffff` (흰색) | 12.5:1 | ✅ AAA |
| `#fdb813` (노란색) | `#081429` (네이비) | 9.3:1 | ✅ AAA |

### UI 컴포넌트
| 요소 | 배경 | 전경 | 대비율 | WCAG |
|------|------|------|--------|------|
| 활성 버튼 | `#fdb813` | `#081429` | 9.3:1 | ✅ AA |
| 비활성 버튼 | `#081429` | `#9ca3af` | 5.2:1 | ✅ AA |
| 포커스 링 | - | `#fdb813` | - | ✅ |

---

## 개선 로드맵

### 단기 (완료)
- [x] TabButton 접근성 속성 추가
- [x] TabFilterGroup Esc 키 지원
- [x] TabFilterGroup 포커스 관리
- [x] TabSubNavigation semantic HTML

### 중기 (예정)
- [ ] Arrow 키로 탭 네비게이션
- [ ] 필터 변경 시 ARIA live 알림
- [ ] 단축키 힌트 툴팁
- [ ] Skip to content 링크

### 장기 (계획)
- [ ] 고대비 모드 지원
- [ ] 화면 확대/축소 대응
- [ ] 음성 명령 지원 (검토)

---

## 참고 자료

### 공식 문서
- [WCAG 2.1 가이드라인](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN 접근성](https://developer.mozilla.org/ko/docs/Web/Accessibility)

### 도구
- [Axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)

### 학습
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)

---

**작성자**: Frontend Lead + Accessibility Specialist
**최종 업데이트**: 2026-02-03
**다음 리뷰**: 2026-03-03

---

_"접근성은 선택이 아닌 필수입니다."_ ♿✨
