# Settings Modal 재구성 계획

**작성일**: 2026-01-13  
**상태**: 계획 단계  
**우선순위**: High (Issue #22)

---

## 현재 문제점

### 1. 복잡한 탭 구조
- **5개 메인 탭**: Calendar, Timetable, Permissions, Gantt, Attendance
- **13개 서브 탭**: departments, users, teachers, classes, hashtags, role_permissions, tab_access, migration, gantt_departments, gantt_categories, salary_settings, system
- 사용자가 원하는 설정을 찾기 어려움

### 2. 중복된 기능
- **부서 관리**: Calendar 탭과 Gantt 탭에 각각 존재
- **권한 관리**: 여러 탭에 분산 (role_permissions, tab_access, users)

### 3. 일관성 부족
- 각 탭마다 다른 레이아웃과 스타일
- 권한 체크 로직이 혼재되어 있음
- 검색/필터 기능이 일부 탭에만 존재

### 4. 탐색의 어려움
- 깊이가 2단계 (메인 탭 > 서브 탭)
- 빵부스럽게 탭 간 이동
- 현재 위치 파악 어려움

---

## 제안하는 새로운 구조

### Option A: 기능 중심 구조 (추천)

```
┌─ 일반 설정 (General)
│  ├─ 화면 설정 (Display Settings)
│  ├─ 휴일 관리 (Holidays)
│  ├─ 보관 설정 (Archive Settings)
│  └─ 시스템 설정 (System Config)
│
├─ 사용자 & 권한 (Users & Permissions)
│  ├─ 사용자 관리 (Users)
│  ├─ 역할 권한 (Role Permissions)
│  └─ 탭 접근 (Tab Access)
│
├─ 부서 & 조직 (Departments & Organization)
│  ├─ Calendar 부서 (Calendar Departments)
│  ├─ Gantt 부서 (Gantt Departments)
│  ├─ 카테고리 관리 (Categories)
│  └─ 해시태그 (Hashtags)
│
├─ 수업 & 강사 (Classes & Teachers)
│  ├─ 강사 관리 (Teachers)
│  ├─ 수업 관리 (Classes)
│  └─ 급여 설정 (Salary Settings)
│
└─ 고급 설정 (Advanced)
   ├─ 데이터 마이그레이션 (Data Migration)
   ├─ Gantt 카테고리 (Gantt Categories)
   └─ 개발자 도구 (Developer Tools)
```

### Option B: 역할 기반 구조

```
┌─ 내 설정 (My Settings)
│  └─ 개인 환경 설정
│
├─ 일반 관리 (General Management)
│  ├─ 부서, 휴일, 시스템
│  └─ 누구나 볼 수 있는 설정
│
├─ 사용자 관리 (User Management)
│  └─ Admin/Master만 접근
│
└─ 시스템 관리 (System Administration)
   └─ Master만 접근
```

---

## 개선 사항

### 1. UI/UX 개선

#### 1.1 검색 기능 추가
```tsx
// 전역 설정 검색
<input 
  type="search"
  placeholder="설정 검색... (예: 휴일, 강사, 권한)"
  className="..."
/>
```

#### 1.2 Quick Settings 섹션
자주 사용하는 설정을 최상단에 배치:
- 기본 뷰 모드
- 기본 탭
- 다크 모드
- 알림 설정

#### 1.3 도움말 툴팁
각 설정 항목에 `(?)` 아이콘으로 도움말 제공

#### 1.4 변경사항 추적
- 수정된 설정 하이라이트
- "n개의 변경사항" 표시
- 일괄 저장 vs 개별 저장 선택 가능

### 2. 기술적 개선

#### 2.1 컴포넌트 분리
현재 1053 라인의 SettingsModal.tsx를 다음과 같이 분리:

```
settings/
├── SettingsModal.tsx (메인 컨테이너, ~200 라인)
├── SettingsNav.tsx (사이드바 네비게이션)
├── SettingsSearch.tsx (검색 기능)
├── sections/
│   ├── GeneralSettings.tsx
│   ├── UserPermissions.tsx
│   ├── DepartmentSettings.tsx
│   ├── ClassTeacherSettings.tsx
│   └── AdvancedSettings.tsx
└── hooks/
    ├── useSettingsState.ts
    ├── useSettingsSave.ts
    └── useSettingsPermissions.ts
```

#### 2.2 상태 관리 개선
```tsx
// 현재: 여러 useState 사용 (50+ 개)
const [newDepartmentForm, setNewDepartmentForm] = useState(...)
const [categoryManagement, setCategoryManagement] = useState(...)
// ... 50+ more

// 개선: useReducer 또는 컨텍스트 사용
const [state, dispatch] = useSettingsReducer();
```

#### 2.3 권한 체크 중앙화
```tsx
// useSettingsPermissions hook 생성
const {
  canViewSection,
  canEditSection,
  visibleSections
} = useSettingsPermissions(currentUserProfile);
```

### 3. 접근성 개선

- 키보드 내비게이션 (Tab, Arrow keys)
- ARIA 레이블 추가
- 포커스 관리 개선
- 스크린 리더 지원

---

## 구현 계획

### Phase 1: 구조 개선 (8시간)
1. ✅ 문서화 (현재)
2. 새로운 탭 구조 디자인
3. SettingsNav 컴포넌트 생성
4. 메인 컨테이너 리팩토링

### Phase 2: 기능 분리 (16시간)
1. 각 섹션을 별도 컴포넌트로 분리
2. 상태 관리 개선 (useReducer)
3. 권한 체크 중앙화

### Phase 3: UX 개선 (8시간)
1. 검색 기능 구현
2. Quick Settings 추가
3. 도움말 툴팁
4. 변경사항 추적

### Phase 4: 테스트 & 문서화 (4시간)
1. 모든 권한 레벨 테스트
2. 사용자 가이드 작성
3. 개발자 문서 업데이트

**총 예상 시간**: 36시간

---

## 대안: 점진적 개선

전면 리팩토링 대신 점진적으로 개선:

### Quick Wins (각 1-2시간)
1. ✅ **탭 아이콘 추가** - 시각적 인식 개선
2. **툴팁 추가** - 각 설정 항목에 도움말
3. **검색 바 추가** - 상단에 설정 검색
4. **즐겨찾기** - 자주 사용하는 설정 북마크
5. **최근 사용** - 최근 수정한 설정 표시

---

## 다음 단계

1. **결정 필요**: Option A vs Option B vs 점진적 개선
2. **우선순위 설정**: 어떤 개선부터 시작할지
3. **사용자 피드백**: 현재 Settings에서 가장 불편한 점

**권장사항**: 현재는 점진적 개선(Quick Wins)으로 시작하고, 사용자 피드백을 수집한 후 전면 리팩토링 결정

---

## 참고 자료

- [Material-UI Settings Pattern](https://mui.com/material-ui/react-drawer/)
- [Ant Design Settings Pattern](https://ant.design/components/menu)
- [macOS System Preferences](https://support.apple.com/guide/mac-help/welcome/mac)
- [VS Code Settings UI](https://code.visualstudio.com/docs/getstarted/settings)