# IJW Calendar - Project Overview & Technical Documentation

> **Last Updated**: 2025-12-29  
> **Version**: `abfe4a0` (Synchronized with origin/main)  
> **Project Name**: 인재원 통합 일정 관리 시스템

---

## 1. 프로젝트 개요

### 1.1. 프로젝트 목적
학원/교육기관의 **연간 일정 관리** 및 **시간표 관리**를 통합하여 제공하는 웹 기반 애플리케이션입니다.

### 1.2. 핵심 기능
| 기능 카테고리 | 주요 기능 |
|--------------|----------|
| 📅 **일정 관리** | 일간/주간/월간/연간 뷰, 드래그 앤 드롭 이동, 반복 일정, 다중 부서 연동 |
| 🕐 **시간표 관리** | 수학/영어 과목별 관리, 강사별/교실별/통합 뷰, 학생 드래그 이동 |
| 👥 **권한 관리** | 7단계 역할 체계, 부서별 접근 권한, Firestore 기반 권한 설정 |
| 🔐 **인증** | Firebase Auth (이메일/Google), 관리자 승인 시스템 |
| 📊 **추가 기능** | 연간 히트맵, 버킷 리스트, 업무 메모(쪽지), 다크 모드 |

---

## 2. 기술 스택

### 2.1. Core Framework
```
React 19.2.3 + TypeScript 5.8.2
Vite 6.2.0 (Build Tool)
```

### 2.2. Backend / Database
```
Firebase 12.7.0
├── Firestore (NoSQL Database)
├── Authentication (Email/Google)
└── Hosting (Production Deployment)
```

### 2.3. UI / Styling
```
TailwindCSS (CDN)
Lucide React 0.562.0 (Icons)
```

### 2.4. 주요 라이브러리
| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| `date-fns` | 4.1.0 | 날짜 계산 및 포맷팅 |
| `@dnd-kit/core` | 6.3.1 | 드래그 앤 드롭 코어 |
| `@dnd-kit/sortable` | 10.0.0 | 정렬 가능 리스트 |
| `@dnd-kit/utilities` | 3.2.2 | DnD 유틸리티 |
| `html2canvas` | 1.4.1 | 화면 캡처 (이미지 저장) |
| `jspdf` | 3.0.4 | PDF 출력 (시간표 등) |

---

## 3. 프로젝트 구조

```
ijw-Calander/
├── App.tsx                     # 메인 컴포넌트 (1,902 lines)
├── index.tsx                   # React 진입점
├── index.html                  # HTML 템플릿 + CDN
├── index.css                   # 전역 스타일 + 다크모드
│
├── types.ts                    # TypeScript 타입 정의 (230 lines)
├── constants.ts                # 상수 정의 (부서 초기값 등)
├── constants_holidays.ts       # 공휴일 데이터
├── converters.ts               # Firestore 데이터 변환기
├── firebaseConfig.ts           # Firebase 설정
│
├── hooks/
│   └── usePermissions.ts       # 역할 기반 권한 관리 Hook
│
├── utils/
│   └── styleUtils.ts           # 스타일 유틸리티 함수
│
└── components/
    ├── CalendarBoard.tsx       # 캘린더 메인 보드 (21KB)
    ├── WeekBlock.tsx           # 주간 뷰 블록 (23KB)
    ├── YearlyView.tsx          # 연간 뷰 + 히트맵 (28KB)
    ├── EventModal.tsx          # 일정 생성/수정 모달 (38KB)
    ├── SettingsModal.tsx       # 시스템 설정 모달 (~100KB, Phase 1 리팩토링 완료)
    ├── LoginModal.tsx          # 로그인 모달 (12KB)
    ├── BucketModal.tsx         # 버킷 리스트 모달 (7KB)
    ├── MyEventsModal.tsx       # 내 일정 모달 (12KB)
    │
    ├── ErrorBoundary.tsx       # 에러 경계 컴포넌트 (2.3KB)
    ├── PortalTooltip.tsx       # 포털 툴팁 컴포넌트 (3.3KB)
    ├── CustomSelect.tsx        # 커스텀 셀렉트 컴포넌트 (3.5KB)
    │
    ├── settings/               # 설정 모달 탭 컴포넌트 (Phase 1-3 리팩토링 완료)
    │   ├── index.ts            # export 파일
    │   ├── TeachersTab.tsx     # 강사 관리 탭 (340줄)
    │   ├── ClassesTab.tsx      # 수업 키워드 관리 탭 (140줄)
    │   ├── HolidaysTab.tsx     # 공휴일 관리 탭 (215줄)
    │   └── RolePermissionsTab.tsx # 역할별 권한 설정 (255줄)
    │
    └── Timetable/
        ├── TimetableManager.tsx    # 수학 시간표 관리 (55KB)
        └── English/
            ├── EnglishTimetable.tsx        # 영어 시간표 메인 (8.5KB)
            ├── EnglishTeacherTab.tsx       # 강사별 탭 (38KB)
            ├── EnglishClassTab.tsx         # 통합/수업별 탭 (28KB)
            ├── EnglishRoomTab.tsx          # 교실별 탭 (6.6KB)
            ├── IntegrationViewSettings.tsx # 통합 뷰 설정 (18KB)
            ├── BatchInputBar.tsx           # 배치 입력 바 (7.9KB)
            ├── MoveConfirmBar.tsx          # 이동 확인 바 (1.5KB)
            ├── MoveSelectionModal.tsx      # 이동 선택 모달 (5.5KB)
            ├── TeacherOrderModal.tsx       # 강사 순서 모달 (6.8KB)
            └── englishUtils.ts             # 영어 시간표 유틸 (2.3KB)
```

---

## 4. Firestore 컬렉션 구조

### 4.1. 주요 컬렉션
| 컬렉션 | 문서 ID | 설명 |
|--------|---------|------|
| `부서목록` | 부서명 | 부서/프로그램 정보 |
| `일정` | auto-generated | 캘린더 일정 데이터 |
| `users` | uid | 사용자 프로필 및 권한 |
| `강사목록` | 강사명 | 시간표 강사 정보 |
| `수업목록` | 과목_강사_수업명 | 시간표 수업 데이터 |
| `holidays` | auto | 공휴일/휴무일 |
| `system/config` | - | 시스템 설정 (lookback, categories) |
| `settings/rolePermissions` | - | 역할별 권한 설정 |
| `bucketItems` | auto | 버킷 리스트 |
| `taskMemos` | auto | 업무 메모/쪽지 |

### 4.2. 데이터 구독 최적화 (Firebase 비용 절감)
- **중앙 구독**: `App.tsx`에서 `강사목록`을 한 번만 구독
- **Props 전달**: 자식 컴포넌트에 데이터 전달 (SettingsModal, TimetableManager 등)
- **중복 제거**: 기존 각 컴포넌트별 별도 구독 제거

### 4.3. 데이터 변환 시스템 (Firestore Converters)

#### 4.3.1. 한글 로컬라이제이션
프로젝트는 Firestore에 **한글 필드명**을 사용하고, TypeScript에서 **영문 필드명**을 사용하기 위해 커스텀 컨버터를 구현했습니다.

**파일**: `converters.ts` (99 lines)

#### 4.3.2. Department Converter
```typescript
// TypeScript → Firestore (한글)
{ name: "수학과", order: 1 }
  → { 부서명: "수학과", 순서: 1 }

// Firestore (한글) → TypeScript
{ 부서명: "수학과", 순서: 1 }
  → { name: "수학과", order: 1 }
```

**변환 필드 매핑:**
| TypeScript | Firestore (한글) |
|-----------|----------------|
| name | 부서명 |
| order | 순서 |
| color | 색상 |
| category | 카테고리 |
| defaultColor | 기본색상 |
| defaultTextColor | 기본글자색 |
| defaultBorderColor | 기본테두리색 |

#### 4.3.3. Event Converter
**변환 필드 매핑:**
| TypeScript | Firestore (한글) |
|-----------|----------------|
| title | 제목 |
| description | 상세내용 |
| participants | 참가자 |
| departmentId | 부서ID |
| departmentIds | 부서ID목록 |
| startDate | 시작일 |
| endDate | 종료일 |
| startTime | 시작시간 |
| endTime | 종료시간 |
| isAllDay | 하루종일 |
| color | 색상 |
| textColor | 글자색 |
| borderColor | 테두리색 |
| authorId | 작성자ID |
| authorName | 작성자명 |
| createdAt | 생성일시 |
| updatedAt | 수정일시 |
| attendance | 참가현황 |
| recurrenceGroupId | 반복그룹ID |
| recurrenceIndex | 반복순서 |
| recurrenceType | 반복유형 |
| relatedGroupId | 연결그룹ID |

#### 4.3.4. 특수 로직
- **하루종일 자동 추론**: 시작시간/종료시간이 비어있으면 `isAllDay = true`
- **기본값 처리**: textColor 기본값 `#ffffff`, borderColor 기본값은 color와 동일
- **다중 부서**: departmentIds가 없으면 `[departmentId]`로 자동 변환

**장점:**
- Firestore 데이터베이스에서 한글 필드명 사용 → 가독성 향상
- TypeScript 코드에서 영문 필드명 사용 → 개발 생산성 향상
- 타입 안전성 보장 (컴파일 타임 검증)

### 4.4. 성능 최적화 전략

#### 4.4.1. Firebase 비용 절감 (Read 횟수 최적화)
**문제**: 각 컴포넌트가 Firestore 컬렉션을 개별 구독 → 중복 Read 발생

**해결 (Commit: 2fe3320)**:
```typescript
// Before: 각 컴포넌트에서 구독
// SettingsModal.tsx, TimetableManager.tsx, EnglishTimetable.tsx
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, '강사목록'), ...);
}, []);

// After: App.tsx 중앙 구독 + Props 전달
function App() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, '강사목록'), ...);
    return unsubscribe;
  }, []);

  return (
    <SettingsModal teachers={teachers} />
    <TimetableManager teachers={teachers} />
  );
}
```

**효과:**
- 강사목록 Read: 3회/변경 → 1회/변경 (66% 감소)
- 월 예상 절감: ~$5-10 (중소 규모 사용자 기준)

#### 4.4.2. 오프라인 퍼시스턴스
```typescript
// firebaseConfig.ts
import { persistentLocalCache } from 'firebase/firestore';

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

**효과:**
- 네트워크 끊김 시에도 캐시된 데이터 표시
- 재연결 시 자동 동기화
- Read 횟수 추가 절감 (캐시 히트 시)

#### 4.4.3. 드래그 앤 드롭 최적화
- **@dnd-kit 라이브러리**: 가상 DOM 최적화로 부드러운 UX
- **배치 업데이트**: 드래그 완료 후 한 번에 Firestore 업데이트

#### 4.4.4. 이미지 및 PDF 생성
- **html2canvas**: 화면 캡처 시 Canvas API 활용
- **jspdf**: 클라이언트 측 PDF 생성 (서버 부담 없음)

---

## 5. 권한 시스템

### 5.1. 7단계 역할 체계

| 역할 | 레벨 | 설명 |
|------|------|------|
| `master` | 1 | 최고 관리자 (모든 권한) |
| `admin` | 2 | 관리자 (대부분 권한 + 사용자 관리) |
| `manager` | 3 | 매니저 (일정/부서 관리) |
| `editor` | 4 | 편집자 (일정 편집 가능) |
| `user` | 5 | 일반 사용자 (기본) |
| `viewer` | 6 | 열람자 (읽기 전용) |
| `guest` | 7 | 게스트 (최소 권한) |

### 5.2. 세부 권한 ID (PermissionId)

시스템은 **21개의 세분화된 권한**을 5개 카테고리로 관리합니다.

#### 5.2.1. 일정 관련 권한 (Events - 7개)
| 권한 ID | 설명 |
|--------|------|
| `events.create` | 새 일정 생성 |
| `events.edit_own` | 본인이 만든 일정 수정 |
| `events.edit_others` | 타인이 만든 일정 수정 |
| `events.delete_own` | 본인이 만든 일정 삭제 |
| `events.delete_others` | 타인이 만든 일정 삭제 |
| `events.drag_move` | 드래그 앤 드롭으로 일정 이동 |
| `events.attendance` | 참가 현황 관리 |

#### 5.2.2. 버킷 리스트 권한 (Buckets - 2개)
| 권한 ID | 설명 |
|--------|------|
| `buckets.edit_lower_roles` | 하위 역할 버킷 아이템 수정 |
| `buckets.delete_lower_roles` | 하위 역할 버킷 아이템 삭제 |

#### 5.2.3. 부서 관련 권한 (Departments - 4개)
| 권한 ID | 설명 |
|--------|------|
| `departments.view_all` | 모든 부서 조회 |
| `departments.create` | 새 부서 생성 |
| `departments.edit` | 부서 정보 수정 |
| `departments.delete` | 부서 삭제 |

#### 5.2.4. 사용자 관리 권한 (Users - 4개)
| 권한 ID | 설명 |
|--------|------|
| `users.view` | 사용자 목록 조회 |
| `users.approve` | 신규 사용자 승인/거부 |
| `users.change_role` | 사용자 역할 변경 |
| `users.change_permissions` | 사용자 세부 권한 변경 |

#### 5.2.5. 시스템 설정 권한 (Settings - 4개)
| 권한 ID | 설명 |
|--------|------|
| `settings.access` | 설정 모달 접근 |
| `settings.holidays` | 공휴일 관리 |
| `settings.role_permissions` | 역할별 권한 매트릭스 편집 |
| `settings.manage_categories` | 부서 카테고리 관리 |

> **참고**: 시간표 관련 권한(강사/수업 관리)은 별도 권한 체계로 관리되지 않으며, `settings.access` 권한으로 통합 관리됩니다.

#### 5.2.6. TypeScript 타입 정의
```typescript
// types.ts (Line 88-95)
export type PermissionId =
  | 'events.create' | 'events.edit_own' | 'events.edit_others'
  | 'events.delete_own' | 'events.delete_others' | 'events.drag_move'
  | 'events.attendance'
  | 'buckets.edit_lower_roles' | 'buckets.delete_lower_roles'
  | 'departments.view_all' | 'departments.create' | 'departments.edit' | 'departments.delete'
  | 'users.view' | 'users.approve' | 'users.change_role' | 'users.change_permissions'
  | 'settings.access' | 'settings.holidays' | 'settings.role_permissions'
  | 'settings.manage_categories';
```

### 5.3. 부서별 접근 권한
- **차단(block)**: 부서 접근 불가
- **조회(view)**: 부서 일정 열람만 가능
- **수정(edit)**: 부서 일정 생성/수정/삭제 가능

---

## 6. 주요 데이터 타입

### 6.1. CalendarEvent (일정)
```typescript
interface CalendarEvent {
  id: string;
  departmentId: string;
  departmentIds?: string[];      // 다중 부서
  title: string;
  description?: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;
  startTime?: string;            // HH:mm
  endTime?: string;
  isAllDay?: boolean;
  color?: string;
  textColor?: string;
  borderColor?: string;
  recurrenceType?: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly';
  recurrenceGroupId?: string;    // 반복 일정 그룹
  relatedGroupId?: string;       // 다중 부서 연동 그룹
  authorId?: string;
  authorName?: string;
  attendance?: Record<string, 'pending' | 'joined' | 'declined'>;
}
```

### 6.2. Teacher (강사)
```typescript
interface Teacher {
  id: string;
  name: string;
  subjects?: ('math' | 'english')[];
  isHidden?: boolean;
  order?: number;
  defaultRoom?: string;
  bgColor?: string;
  textColor?: string;
}
```

### 6.3. TimetableClass (수업)
```typescript
interface TimetableClass {
  id: string;
  className: string;
  teacher: string;
  room?: string;
  subject: string;            // '수학' | '영어'
  schedule: string[];         // ['월 1교시', '화 2교시', ...]
  studentList: TimetableStudent[];
  order?: number;
}
```

---

## 7. 컴포넌트 상세

### 7.1. App.tsx (메인 컴포넌트)
**크기**: 1,901 Lines | 85KB
**책임**:
- 전역 상태 관리 (events, departments, users, teachers)
- Firebase 구독 중앙화
- 라우팅 (calendar/timetable 모드 전환)
- 이벤트 CRUD 핸들러
- 드래그 앤 드롭 이벤트 처리
- 버킷 리스트 / 업무 메모 관리

**주요 함수**:
| 함수 | 설명 |
|------|------|
| `handleSaveEvent` | 일정 저장 (반복/다중부서 지원) |
| `handleDeleteEvent` | 일정 삭제 (연동 삭제 옵션) |
| `handleEventMove` | 드래그 앤 드롭 이동 |
| `handleBatchUpdateAttendance` | 반복 일정 참석 일괄 변경 |
| `handleSendMemo` | 업무 메모 전송 |
| `handleBucketItemAdd` | 버킷 리스트 아이템 추가 |
| `handleBucketItemDelete` | 버킷 리스트 아이템 삭제 |
| `updateUserRole` | 사용자 역할 변경 (권한 확인) |
| `updateUserDepartmentPermissions` | 부서별 접근 권한 설정 |

**전역 상태 관리:**
- `events`: `CalendarEvent[]` - 캘린더 일정
- `departments`: `Department[]` - 부서 목록
- `users`: `UserProfile[]` - 사용자 목록
- `teachers`: `Teacher[]` - 강사 목록
- `timetableClasses`: `TimetableClass[]` - 수업 목록
- `bucketItems`: `BucketItem[]` - 버킷 리스트
- `taskMemos`: `TaskMemo[]` - 업무 메모

### 7.2. SettingsModal.tsx (설정 모달)
**크기**: 2,120 Lines | 119KB (프로젝트 최대)
**상태**: ⚠️ 리팩토링 권장 (탭별 컴포넌트 분리)

**기능**:
- **부서 관리**: CRUD + 카테고리 관리
- **사용자 관리**: 승인/역할/세부 권한 편집
- **강사 관리**: 시간표용 강사 CRUD + 순서 변경
- **공휴일 관리**: 공휴일 추가/삭제
- **수업 키워드**: 키워드별 색상 설정 (영어 시간표)
- **역할 권한**: 7단계 역할 × 21개 권한 매트릭스 편집

**주요 탭**:
1. **부서 탭**: Department CRUD + Category 관리
2. **사용자 탭**: Pending 승인 + Role 변경 + Permission 편집
3. **강사 탭**: Teacher 관리 + Order 정렬
4. **공휴일 탭**: Holiday 추가/삭제
5. **권한 탭**: Role-Permission Matrix 편집 (MASTER 전용)

### 7.3. TimetableManager.tsx (수학 시간표)
**크기**: 56KB  
**기능**:
- 수학 과목 시간표 표시 (1~4교시)
- 강사별/교실별 뷰
- 학생 드래그 이동 + 배치 저장
- 주간 네비게이션

### 7.4. EnglishTimetable.tsx (영어 시간표)
**크기**: 9KB (Wrapper) + 38KB (TeacherTab) + 28KB (ClassTab)  
**기능**:
- 영어 과목 시간표 (1~8교시)
- 강사별/교실별/통합 뷰
- 통합 뷰 고급 설정 (색상, 병합 등)

---

## 8. 최근 주요 변경사항

### 8.1. Firebase 비용 최적화 (Commit: 8acfc06)
- 강사목록 구독을 App.tsx로 통합
- SettingsModal, TimetableManager, EnglishTimetable에서 중복 구독 제거
- Props를 통한 데이터 전달로 Firestore Read 횟수 감소

### 8.2. 연간 뷰 히트맵 & 범례 (Commit: b0d24d3)
- YearlyView에 카테고리별 히트맵 기능 추가
- 일정 밀도 시각화
- 범례(Legend) UI 추가

### 8.3. 버킷 리스트 & 업무 메모 (Commit: abfe4a0)
- 월별 미정 일정 버킷 리스트
- 사용자 간 업무 메모/쪽지 시스템
- BucketModal, TaskMemo 타입 추가

### 8.4. 컴포넌트 아키텍처 & 코드 품질

#### 8.4.1. 파일 크기 분석
| 컴포넌트 | 라인 수 | 크기 | 상태 |
|---------|--------|------|------|
| SettingsModal.tsx | 2,120 | 119KB | ⚠️ 리팩토링 권장 |
| App.tsx | 1,901 | 85KB | ✅ 양호 (메인 컴포넌트) |
| EnglishTeacherTab.tsx | ~900 | 38KB | ✅ 양호 |
| EventModal.tsx | ~900 | 38KB | ✅ 양호 |
| EnglishClassTab.tsx | ~650 | 28KB | ✅ 양호 |
| YearlyView.tsx | ~650 | 28KB | ✅ 양호 |

#### 8.4.2. 코드 품질 평가

**우수 사례 (Best Practices):**
- ✅ **중앙 구독 패턴**: App.tsx에서 Firestore 구독 통합 → Firebase 비용 절감
- ✅ **타입 안전성**: TypeScript 5.8 + 엄격한 타입 정의 (types.ts 230줄)
- ✅ **Props 전달**: 중복 구독 대신 데이터를 Props로 전달
- ✅ **권한 시스템**: usePermissions Hook 기반 역할 관리
- ✅ **에러 경계**: ErrorBoundary 컴포넌트 구현

**개선 필요 영역:**
- ✅ **SettingsModal.tsx 리팩토링 완료 (Phase 1-3)**:
  - Phase 1: TeachersTab, ClassesTab 분리
  - Phase 2: HolidaysTab 분리
  - Phase 3: RolePermissionsTab 분리  
  - **총 감소: 2,122줄 → 1,321줄 (38% 개선)**
- ✅ **App.tsx (1,901줄)**:
  - 메인 컴포넌트로 허용 범위 내

#### 8.4.3. 재사용 가능 컴포넌트
| 컴포넌트 | 용도 | 크기 |
|---------|------|------|
| CustomSelect.tsx | 커스텀 드롭다운 | 3.5KB |
| PortalTooltip.tsx | 포털 기반 툴팁 | 3.3KB |
| ErrorBoundary.tsx | React 에러 캐치 | 2.3KB |

**설계 원칙:**
- 작은 유틸리티 컴포넌트 별도 파일 분리
- 재사용성 높은 UI 컴포넌트 우선 추출

---

## 9. 개발 환경 설정

### 9.1. 로컬 실행
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 9.2. 프로덕션 빌드
```bash
npm run build
```

### 9.3. Firebase 배포
```bash
firebase deploy --only hosting
```

---

## 10. 향후 개선 과제

| 우선순위 | 항목 | 설명 |
|---------|------|------|
| ✅ Complete | 코드 분할 | SettingsModal Phase 1-3 완료 (**38% 감소**) |
| 🟠 Medium | 모바일 최적화 | 반응형 레이아웃 개선 (특히 시간표 뷰) |
| 🟠 Medium | 성능 모니터링 | Firebase Performance SDK 통합 |
| 🟢 Low | 테스트 추가 | Jest/Vitest 단위 테스트 + React Testing Library |
| 🟢 Low | CI/CD | GitHub Actions 자동 배포 파이프라인 |

### 10.1. 이미 구현된 기능
- ✅ **오프라인 지원**: Firestore `persistentLocalCache()` 활성화 (firebaseConfig.ts)
- ✅ **중앙 구독**: Firebase 비용 절감을 위한 강사목록 구독 통합 (App.tsx)
- ✅ **SettingsModal 리팩토링** (2025-12-30):
  - Phase 1: `TeachersTab.tsx` (340줄), `ClassesTab.tsx` (140줄)
  - Phase 2: `HolidaysTab.tsx` (215줄)
  - Phase 3: `RolePermissionsTab.tsx` (255줄)
  - 결과: 2,122줄 → 1,321줄 (**801줄 감소, 38% 개선**)

---

*Document generated by Claude with project analysis*
