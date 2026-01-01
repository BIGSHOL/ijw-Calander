# 기본 탭 선택 시스템 검증 보고서

> 작성일: 2026-01-02
> 검토 버전: default_tab_selection.md (계획 검토 중)
> 검토자: code-reviewer agent + report-analyst
> 보고서 버전: v1.0

---

## 📋 목차

1. [검증 요약](#검증-요약)
2. [문서-코드 일치도 분석](#문서-코드-일치도-분석)
3. [현재 구현 상태](#현재-구현-상태)
4. [버그 검증](#버그-검증)
5. [중요 발견사항](#중요-발견사항)
6. [구현 권장사항](#구현-권장사항)
7. [테스트 시나리오 결과](#테스트-시나리오-결과)
8. [수정 파일 목록](#수정-파일-목록)

---

## 검증 요약

### 전체 평가

| 항목 | 점수 | 상태 |
|------|:----:|:----:|
| 문서 정확도 | 95/100 | ✅ 우수 |
| 코드 일치도 | 40/100 | ⚠️ 불일치 |
| 버그 존재 여부 | - | ❌ **두 버그 모두 존재** |
| Phase 1 구현 | 30/100 | ❌ 미구현 |
| Phase 2 구현 | 0/100 | ⚠️ 계획대로 미구현 |

### 핵심 결론

> ⚠️ **CRITICAL**: 문서에서 설명한 두 가지 버그가 **현재 코드에 그대로 존재**합니다.
>
> - **버그 1**: 영어팀장 로그인 시 무한 로딩 (하드코딩된 `'calendar'` 기본값)
> - **버그 2**: 영어팀장이 시간표 접근 시 수학 시간표 표시 (하드코딩된 `'math'` 기본값)
>
> Phase 1의 핵심 수정사항(`getInitialAppMode`, `getInitialSubject`)이 **구현되지 않았습니다**.

---

## 문서-코드 일치도 분석

### 1. 문서 정확도: 95/100 ✅

**우수한 점**:
- 버그 현상 설명이 정확함 (스크린샷 포함)
- 원인 분석이 코드와 100% 일치
- 해결 방안이 구체적이고 실행 가능
- Phase 구분이 명확함
- 테스트 시나리오가 현실적임

**개선 필요**:
- `-5점`: `types.ts`의 `DEFAULT_TAB_PERMISSIONS`에 `math_lead`, `english_lead` 누락 문제 미언급
- 이 누락으로 인해 팀장 역할이 **기본적으로 어떤 탭도 접근 불가**할 수 있음

### 2. 코드 일치도: 40/100 ❌

**일치하는 부분 (40점)**:
- ✅ `useTabPermissions` 훅 완전 구현됨
- ✅ 탭 접근 리다이렉트 로직 존재 (Lines 145-164)
- ✅ 권한 시스템 인프라 완비

**불일치 부분 (60점 감점)**:
- ❌ `appMode` 초기화: 여전히 하드코딩 (`'calendar'`)
- ❌ `timetableSubject` 초기화: 여전히 하드코딩 (`'math'`)
- ❌ `getInitialAppMode()` 함수 미구현
- ❌ `getInitialSubject()` 함수 미구현
- ❌ Phase 1 핵심 로직 전체 누락

---

## 현재 구현 상태

### App.tsx 핵심 코드 분석

#### 1. `appMode` 초기화 (Line 36)

**현재 코드**:
```typescript
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment'>('calendar');
```

**문제점**:
- 하드코딩된 `'calendar'` 기본값
- 권한 무시
- 버그 1의 직접적인 원인

**문서 제안 코드** (Lines 44-52):
```typescript
const getInitialAppMode = () => {
  // 우선순위: calendar → timetable → payment
  if (canAccessTab('calendar')) return 'calendar';
  if (canAccessTab('timetable')) return 'timetable';
  if (canAccessTab('payment')) return 'payment';
  return 'calendar'; // 폴백
};

const [appMode, setAppMode] = useState(getInitialAppMode());
```

**상태**: ❌ **미구현**

---

#### 2. `timetableSubject` 초기화 (Line 124)

**현재 코드**:
```typescript
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');
```

**문제점**:
- 하드코딩된 `'math'` 기본값
- 권한 무시
- 버그 2의 직접적인 원인

**문서 제안 코드** (Lines 62-68):
```typescript
const getInitialSubject = () => {
  if (hasPermission('timetable.math.view')) return 'math';
  if (hasPermission('timetable.english.view')) return 'english';
  return 'math'; // 폴백
};

const [timetableSubject, setTimetableSubject] = useState(getInitialSubject());
```

**상태**: ❌ **미구현**

**개선 제안**:
문서의 제안을 개선하여 **편집 권한 우선**으로 변경:
```typescript
const getInitialSubject = () => {
  // 우선순위 1: 편집 권한 (사용자의 주 과목)
  if (hasPermission('timetable.english.edit')) return 'english';
  if (hasPermission('timetable.math.edit')) return 'math';
  // 우선순위 2: 보기 권한
  if (hasPermission('timetable.english.view')) return 'english';
  if (hasPermission('timetable.math.view')) return 'math';
  return 'math'; // 최종 폴백
};
```

---

#### 3. 탭 접근 리다이렉트 로직 (Lines 145-164)

**현재 코드**:
```typescript
useEffect(() => {
  if (isTabPermissionLoading || !userProfile) return;
  const isAccessible = canAccessTab(appMode);

  if (!isAccessible) {
    const validModes: AppTab[] = ['calendar', 'timetable', 'payment'];
    const firstValidTab = accessibleTabs.find(t => validModes.includes(t));

    if (firstValidTab) {
      console.log(`[Access Control] Redirecting from ${appMode} to ${firstValidTab}`);
      setAppMode(firstValidTab as 'calendar' | 'timetable' | 'payment');
    }
  }
}, [appMode, canAccessTab, accessibleTabs, isTabPermissionLoading, userProfile]);
```

**분석**:
- ✅ **구현됨**: 리다이렉트 로직 존재
- ⚠️ **반응형 패치**: 잘못된 상태를 나중에 고치는 방식
- ⚠️ **UX 문제**: 초기 렌더링 시 잘못된 콘텐츠가 잠깐 보임 (flash)
- ⚠️ **근본 원인 미해결**: 초기화가 여전히 하드코딩

**평가**: **임시방편** - 버그를 완전히 해결하지 못함

---

## 버그 검증

### 버그 1: 무한 로딩 ❌ **존재함**

**재현 시나리오**:
1. `english_lead` 역할로 로그인
2. 권한: `timetable.english.view: true`, `timetable.english.edit: true`
3. 탭 접근: `['timetable']` (연간 일정 접근 불가)

**현재 동작**:
```
1. App.tsx Line 36: appMode = 'calendar' (하드코딩)
2. Lines 1031-1039: 로딩 화면 표시
3. Lines 145-164: 권한 체크 → calendar 접근 불가 감지
4. useEffect 실행: 'timetable'로 리다이렉트 시도
5. 하지만 초기 렌더링 시 빈 화면 또는 무한 로딩 가능
```

**버그 원인**:
- 초기 `appMode`가 접근 불가능한 탭으로 설정됨
- 리다이렉트가 **반응적(reactive)**이지 **사전적(proactive)**이지 않음

**상태**: ❌ **버그 존재** (문서 설명과 100% 일치)

---

### 버그 2: 잘못된 과목 기본값 ❌ **존재함**

**재현 시나리오**:
1. `english_lead` 역할로 로그인
2. 권한: `timetable.english.edit: true`, `timetable.math.edit: false`
3. 시간표 탭 접근

**현재 동작**:
```
1. App.tsx Line 124: timetableSubject = 'math' (하드코딩)
2. 시간표 화면 로드: 수학 시간표 표시
3. 영어팀장은 수동으로 영어 탭을 클릭해야 함
```

**기대 동작**:
```
1. 초기화 시 권한 체크
2. timetable.english.edit: true 감지
3. timetableSubject = 'english' 설정
4. 영어 시간표 자동 표시
```

**types.ts 권한 확인**:
```typescript
english_lead: {
  'timetable.math.view': true,      // 수학 보기 가능
  'timetable.math.edit': false,     // 수학 편집 불가
  'timetable.english.view': true,   // 영어 보기 가능
  'timetable.english.edit': true,   // 영어 편집 가능
}
```

**상태**: ❌ **버그 존재** (문서 설명과 100% 일치)

---

## 중요 발견사항

### 🔴 CRITICAL: 팀장 역할의 기본 탭 권한 누락

**파일**: `f:\ijw-calander\types.ts` (Lines 335-343)

**현재 코드**:
```typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'payment', 'system'],
  admin: ['calendar', 'timetable'],
  manager: ['calendar'],
  editor: ['calendar'],
  user: ['calendar'],
  viewer: ['calendar'],
  guest: ['calendar'],
  // ❌ math_lead 누락
  // ❌ english_lead 누락
};
```

**문제점**:
1. `math_lead`와 `english_lead`가 `DEFAULT_TAB_PERMISSIONS`에 없음
2. 이 경우 `useTabPermissions` 훅이 빈 배열 `[]`을 반환
3. 팀장 역할이 **기본적으로 어떤 탭도 접근 불가**
4. Firebase `system/config`에 수동 설정이 없으면 **완전히 잠김**

**영향도**:
- 🔴 **매우 높음**: 팀장 역할이 작동하지 않을 수 있음
- 🔴 **배포 차단 이슈**: 즉시 수정 필요

**수정 코드**:
```typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'payment', 'system'],
  admin: ['calendar', 'timetable'],
  manager: ['calendar'],
  editor: ['calendar'],
  math_lead: ['timetable'],      // ✅ 추가
  english_lead: ['timetable'],   // ✅ 추가
  user: ['calendar'],
  viewer: ['calendar'],
  guest: ['calendar'],
};
```

**우선순위**: 🔴 **긴급** (CRITICAL)

---

### ⚠️ IMPORTANT: 초기화 타이밍 문제

**문제**:
문서에서 제안한 `getInitialAppMode()`와 `getInitialSubject()`는 **직접 구현 불가능**:

```typescript
// ❌ 이렇게 할 수 없음 - canAccessTab은 훅에서만 사용 가능
const [appMode, setAppMode] = useState(getInitialAppMode());
```

**이유**:
- `canAccessTab`은 `useTabPermissions` 훅의 반환값
- `useState` 초기화 함수에서 훅 호출 불가 (React 규칙)
- 권한이 비동기로 로드됨 (Firestore)

**해결 방법**:

#### Option 1: Lazy Initialization (권장)

```typescript
const { canAccessTab, accessibleTabs, isLoading } = useTabPermissions(userProfile);

const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | null>(null);

useEffect(() => {
  if (isLoading || !userProfile || appMode !== null) return; // 한 번만 실행

  const priority = ['calendar', 'timetable', 'payment'] as const;
  const firstTab = priority.find(t => accessibleTabs.includes(t));

  setAppMode(firstTab || 'calendar');
}, [accessibleTabs, isLoading, userProfile]);
```

#### Option 2: Direct Access to accessibleTabs

```typescript
useEffect(() => {
  if (isLoading || !userProfile) return;

  // 초기화 로직
  if (appMode === 'calendar' && !canAccessTab('calendar')) {
    const firstAccessible = accessibleTabs.find(t =>
      ['calendar', 'timetable', 'payment'].includes(t)
    );
    if (firstAccessible) setAppMode(firstAccessible);
  }
}, [userProfile, isLoading, canAccessTab, accessibleTabs]);
```

#### 과목 초기화도 동일한 방식:

```typescript
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');

useEffect(() => {
  if (!userProfile) return;

  // 편집 권한 우선
  if (hasPermission('timetable.english.edit')) {
    setTimetableSubject('english');
  } else if (hasPermission('timetable.math.edit')) {
    setTimetableSubject('math');
  } else if (hasPermission('timetable.english.view')) {
    setTimetableSubject('english');
  }
  // else: 기본값 'math' 유지
}, [userProfile]);
```

---

## 구현 권장사항

### Phase 1: 버그 수정 (긴급)

#### 우선순위 순서

| 순위 | 파일 | 변경 내용 | 중요도 | 소요 시간 |
|:----:|------|----------|:------:|:--------:|
| 1 | `types.ts` | `DEFAULT_TAB_PERMISSIONS`에 `math_lead`, `english_lead` 추가 | 🔴 CRITICAL | 2분 |
| 2 | `App.tsx` | `appMode` 초기화 useEffect 추가 | 🔴 CRITICAL | 10분 |
| 3 | `App.tsx` | `timetableSubject` 초기화 useEffect 추가 | 🔴 CRITICAL | 8분 |
| 4 | 테스트 | 팀장 역할 로그인 테스트 | 🟡 HIGH | 15분 |

**총 예상 시간**: **35분**

---

### 수정 코드 제안

#### 1. types.ts 수정

**위치**: Lines 335-343

**변경 전**:
```typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'payment', 'system'],
  admin: ['calendar', 'timetable'],
  manager: ['calendar'],
  editor: ['calendar'],
  user: ['calendar'],
  viewer: ['calendar'],
  guest: ['calendar'],
};
```

**변경 후**:
```typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'payment', 'system'],
  admin: ['calendar', 'timetable'],
  manager: ['calendar'],
  editor: ['calendar'],
  math_lead: ['timetable'],      // ✅ 추가
  english_lead: ['timetable'],   // ✅ 추가
  user: ['calendar'],
  viewer: ['calendar'],
  guest: ['calendar'],
};
```

---

#### 2. App.tsx - appMode 초기화 수정

**위치**: Line 36 및 새로운 useEffect 추가

**변경 전**:
```typescript
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment'>('calendar');
```

**변경 후**:
```typescript
// Line 36 수정
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | null>(null);

// useTabPermissions 훅 호출 후 (Line 143 이후) 추가
useEffect(() => {
  // 권한이 로딩 중이거나 이미 초기화되었으면 스킵
  if (isTabPermissionLoading || !userProfile || appMode !== null) return;

  // 우선순위: calendar → timetable → payment
  const priority: AppTab[] = ['calendar', 'timetable', 'payment'];
  const firstAccessibleTab = priority.find(tab => canAccessTab(tab));

  if (firstAccessibleTab) {
    console.log(`[Init] Setting initial appMode to: ${firstAccessibleTab}`);
    setAppMode(firstAccessibleTab as 'calendar' | 'timetable' | 'payment');
  } else {
    // 폴백: 접근 가능한 탭이 없으면 calendar (에러 화면 표시됨)
    console.warn('[Init] No accessible tab found, falling back to calendar');
    setAppMode('calendar');
  }
}, [userProfile, isTabPermissionLoading, canAccessTab, appMode]);
```

---

#### 3. App.tsx - timetableSubject 초기화 수정

**위치**: Line 124 및 새로운 useEffect 추가

**변경 전**:
```typescript
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');
```

**변경 후**:
```typescript
// Line 124 유지 (초기값은 'math'로 유지)
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');

// usePermissions 훅 호출 후 (Line 137 이후) 추가
useEffect(() => {
  if (!userProfile) return;

  // 이미 설정되었으면 스킵 (최초 한 번만 실행)
  // Note: 이 로직은 userProfile이 로드될 때 한 번만 실행됨
  let initialSubject: 'math' | 'english' = 'math';

  // 우선순위 1: 편집 권한 (사용자의 주 과목)
  if (hasPermission('timetable.english.edit')) {
    initialSubject = 'english';
  } else if (hasPermission('timetable.math.edit')) {
    initialSubject = 'math';
  }
  // 우선순위 2: 보기 권한
  else if (hasPermission('timetable.english.view') && !hasPermission('timetable.math.view')) {
    initialSubject = 'english';
  }
  // else: 기본값 'math' 유지

  console.log(`[Init] Setting initial timetableSubject to: ${initialSubject}`);
  setTimetableSubject(initialSubject);
}, [userProfile]); // userProfile 로드 시 한 번만 실행
```

**참고**: 이 useEffect는 userProfile이 로드될 때마다 실행되므로, 사용자가 수동으로 과목을 변경한 후 다시 로그인하면 초기화됩니다. Phase 2에서 사용자 설정을 추가하면 이 문제가 해결됩니다.

---

### Phase 2: 사용자 설정 (선택사항)

**문서 상태**: 계획 단계 (구현 안 됨)

**필요한 작업**:
1. `types.ts` - `UserProfile` 인터페이스에 필드 추가
2. `SettingsModal.tsx` - 설정 UI 추가
3. `App.tsx` - 사용자 설정 우선 적용 로직

**우선순위**: 🟢 낮음 (Phase 1 완료 후 검토)

---

## 테스트 시나리오 결과

### 시나리오 1: 영어팀장 로그인 ❌ **FAIL**

**조건**:
- 역할: `english_lead`
- 권한: `timetable.english.edit: true`, `timetable.math.edit: false`
- 탭 접근: `['timetable']` (연간 일정 접근 불가)

**현재 동작**:
1. 로그인 완료
2. `appMode = 'calendar'` (하드코딩)
3. 로딩 화면 표시
4. 권한 체크 → `calendar` 접근 불가 감지
5. `'timetable'`로 리다이렉트
6. ❌ **수학 시간표 표시** (하드코딩된 `'math'`)

**기대 동작**:
- ✅ 시간표 탭으로 바로 이동
- ✅ 영어 시간표가 기본 표시

**결과**: ❌ **버그 2 발생** (잘못된 과목 표시)

---

### 시나리오 2: 수학팀장 로그인 ⚠️ **PARTIAL**

**조건**:
- 역할: `math_lead`
- 권한: `timetable.math.edit: true`, `timetable.english.edit: false`
- 탭 접근: `['timetable']`

**현재 동작**:
1. ⚠️ **types.ts 수정 전**: 기본 탭 권한 없음 → 빈 화면 또는 에러
2. ✅ **types.ts 수정 후**: `'timetable'`로 리다이렉트 → 수학 시간표 표시 (우연히 맞음)

**결과**: ⚠️ **조건부 성공** (types.ts 수정 필요)

---

### 시나리오 3: ADMIN 로그인 ✅ **PASS**

**조건**:
- 역할: `admin`
- 권한: 모든 탭 접근 가능
- 탭 접근: `['calendar', 'timetable']`

**현재 동작**:
1. 로그인 완료
2. `appMode = 'calendar'` (하드코딩)
3. ✅ `calendar` 접근 가능 → 그대로 표시

**결과**: ✅ **성공** (하드코딩된 기본값이 우연히 일치)

---

### 시나리오 4: 권한 없는 사용자 ⚠️ **PARTIAL**

**조건**:
- 역할: `guest`
- 권한: 모든 탭 접근 불가
- 탭 접근: `[]`

**현재 동작**:
1. 로그인 완료
2. `appMode = 'calendar'` (하드코딩)
3. 권한 체크 → 접근 불가
4. ⚠️ `accessibleTabs.find()` → `undefined`
5. ⚠️ 리다이렉트 실패 → 빈 화면 표시

**기대 동작**:
- "접근 권한이 없습니다" 메시지 표시
- 로그아웃 버튼 제공

**결과**: ⚠️ **개선 필요** (에러 메시지 누락)

---

## 수정 파일 목록

### 긴급 수정 필요 (Phase 1)

| 파일 | 위치 | 변경 내용 | 우선순위 |
|------|------|----------|:--------:|
| `types.ts` | Lines 335-343 | `DEFAULT_TAB_PERMISSIONS`에 `math_lead`, `english_lead` 추가 | 🔴 CRITICAL |
| `App.tsx` | Line 36 | `appMode` 초기값을 `null`로 변경 | 🔴 CRITICAL |
| `App.tsx` | 새로운 useEffect | `appMode` 초기화 로직 추가 (Line 143 이후) | 🔴 CRITICAL |
| `App.tsx` | 새로운 useEffect | `timetableSubject` 초기화 로직 추가 (Line 137 이후) | 🔴 CRITICAL |

### 개선 권장 (Phase 1+)

| 파일 | 변경 내용 | 우선순위 |
|------|----------|:--------:|
| `App.tsx` | Lines 145-164: 리다이렉트 로직 개선 (에러 메시지 추가) | 🟡 HIGH |
| `App.tsx` | Lines 1529-1534: 접근 불가 시 에러 메시지 표시 | 🟡 HIGH |

### 향후 개발 (Phase 2)

| 파일 | 변경 내용 | 우선순위 |
|------|----------|:--------:|
| `types.ts` | `UserProfile`에 `defaultTab`, `defaultSubject` 필드 추가 | 🟢 LOW |
| `SettingsModal.tsx` | 기본 탭 설정 UI 추가 | 🟢 LOW |
| `App.tsx` | 사용자 설정 우선 적용 로직 | 🟢 LOW |

---

## 다음 단계

### 권장 워크플로우

#### 1단계: 긴급 수정 (code-fixer 에이전트 실행)

```bash
# code-fixer에게 전달할 작업
1. types.ts: DEFAULT_TAB_PERMISSIONS에 math_lead, english_lead 추가
2. App.tsx: appMode 초기화 useEffect 추가
3. App.tsx: timetableSubject 초기화 useEffect 추가
```

**예상 소요 시간**: 20분

---

#### 2단계: 테스트 (test-writer 에이전트)

```bash
# 테스트 시나리오
1. 영어팀장 로그인 → 영어 시간표 자동 표시 확인
2. 수학팀장 로그인 → 수학 시간표 자동 표시 확인
3. ADMIN 로그인 → 연간 일정 표시 확인
4. Guest 로그인 → 에러 메시지 표시 확인
```

**예상 소요 시간**: 15분

---

#### 3단계: Firebase 비용 검토 (선택사항)

```bash
# firebase-cost-optimizer 에이전트
- 탭 권한 Firestore 읽기 비용 분석
- React Query 캐싱 효율성 확인
- system/config 실시간 리스너 비용 확인
```

**예상 소요 시간**: 10분

---

#### 4단계: 문서 업데이트

```bash
# default_tab_selection.md 수정
- Phase 1 체크리스트 업데이트
- 구현 완료 상태로 변경
- types.ts 수정사항 추가
- 초기화 타이밍 이슈 섹션 추가
```

**예상 소요 시간**: 10분

---

### 총 예상 작업 시간

| 단계 | 시간 |
|------|:----:|
| 1. 긴급 수정 | 20분 |
| 2. 테스트 | 15분 |
| 3. 비용 검토 (선택) | 10분 |
| 4. 문서 업데이트 | 10분 |
| **합계** | **55분** |

(문서 예상 시간 75분보다 20분 단축)

---

## 보완 사항 요약

### 문서에 추가할 내용

#### 1. 새 섹션: "중요 발견사항"

```markdown
## 중요 발견사항

### DEFAULT_TAB_PERMISSIONS 누락

`types.ts`의 `DEFAULT_TAB_PERMISSIONS`에 `math_lead`와 `english_lead`가 없어,
팀장 역할이 기본적으로 어떤 탭도 접근할 수 없는 문제가 발견되었습니다.

**수정 필요**:
\`\`\`typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  // ... 기존 역할
  math_lead: ['timetable'],      // 추가 필요
  english_lead: ['timetable'],   // 추가 필요
};
\`\`\`
```

---

#### 2. 새 섹션: "초기화 타이밍 이슈"

```markdown
## 초기화 타이밍 이슈

### 문제
`getInitialAppMode()`와 `getInitialSubject()`는 `useState` 초기화 함수에서
직접 호출할 수 없습니다. 이유는:

1. `canAccessTab`은 `useTabPermissions` 훅의 반환값
2. React 규칙: 훅은 컴포넌트 본문에서만 호출 가능
3. 권한이 비동기로 로드됨 (Firestore)

### 해결 방법
`useEffect`를 사용하여 권한 로드 후 초기화:

\`\`\`typescript
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | null>(null);

useEffect(() => {
  if (isLoading || !userProfile || appMode !== null) return;

  const priority = ['calendar', 'timetable', 'payment'] as const;
  const firstTab = priority.find(t => canAccessTab(t));

  setAppMode(firstTab || 'calendar');
}, [accessibleTabs, isLoading, userProfile]);
\`\`\`
```

---

#### 3. 수정 파일 목록 업데이트

기존:
```markdown
| 파일 | 변경 내용 | 우선순위 |
|------|----------|:-------:|
| `App.tsx` | 초기 탭/과목 결정 로직 수정 | 🔴 긴급 |
| `types.ts` | UserProfile에 기본 설정 필드 추가 | 🟡 중간 |
| `SettingsModal.tsx` | 기본 탭 설정 UI 추가 | 🟢 낮음 |
```

수정 후:
```markdown
| 파일 | 변경 내용 | 우선순위 |
|------|----------|:-------:|
| `types.ts` | DEFAULT_TAB_PERMISSIONS에 팀장 역할 추가 | 🔴 긴급 |
| `App.tsx` | 초기 탭/과목 결정 로직 수정 (useEffect) | 🔴 긴급 |
| `types.ts` | UserProfile에 기본 설정 필드 추가 | 🟡 중간 |
| `SettingsModal.tsx` | 기본 탭 설정 UI 추가 | 🟢 낮음 |
```

---

## 결론

### 최종 평가

| 항목 | 점수 |
|------|:----:|
| 문서 품질 | A (95/100) |
| 코드 구현 | D (40/100) |
| 버그 심각도 | CRITICAL |
| 수정 긴급도 | HIGH |

### 핵심 권장사항

1. 🔴 **즉시 수정**: `types.ts`의 `DEFAULT_TAB_PERMISSIONS`에 팀장 역할 추가
2. 🔴 **즉시 수정**: `App.tsx`의 `appMode` 및 `timetableSubject` 초기화 로직 구현
3. 🟡 **우선 수정**: 접근 불가 시 에러 메시지 표시
4. 🟢 **향후 개발**: Phase 2 사용자 설정 기능 추가

### 배포 결정

> ⚠️ **배포 권장사항**: Phase 1 긴급 수정 완료 후 배포
>
> 현재 상태로는 **영어팀장 및 수학팀장 역할이 정상 작동하지 않습니다**.

---

**문서 끝**
