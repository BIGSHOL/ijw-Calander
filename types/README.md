# 타입 정의 가이드

이 폴더는 학원 관리 시스템(ijw-calendar)의 모든 TypeScript 타입 정의를 포함합니다.

## 📁 파일 구조

### Core Types (핵심)

| 파일 | 역할 | 주요 타입 |
|------|------|----------|
| **index.ts** | 통합 export (barrel file) | - |
| **common.ts** | 공통 타입 및 상수 | `Department`, `Holiday`, `SubjectType`, `DAYS_OF_WEEK` |
| **auth.ts** | 인증 및 권한 시스템 | `UserRole`, `UserProfile`, `PermissionId`, `RolePermissions` |

### Domain Types (도메인별)

#### 학생 관리
- **student.ts**: `UnifiedStudent`, `Enrollment`
- **consultation.ts**: `ConsultationRecord`, `Consultation` (등록 상담 + 재원생 상담)

#### 직원 관리
- **staff.ts**: `StaffMember`, `StaffLeave`, `WeeklySchedule`

#### 수업 관리
- **timetable.ts**: `TimetableClass`, `Teacher`, `EnglishLevel`, `ScenarioEntry`
- **attendance.ts**: `DailyAttendanceRecord`, `AttendanceStatus`, `AttendanceHistory`
- **grades.ts**: `Exam`, `StudentScore`, `LevelTest`, `GoalSetting`, `GradeComment`

#### 일정 관리
- **calendar.ts**: `CalendarEvent`, `BucketItem`, `TaskMemo`, `SeminarEventData`
- **gantt.ts**: `GanttTemplate`, `GanttProject`, `GanttSubTask`

#### 운영 관리
- **billing.ts**: `BillingRecord`, `BillingSummaryStats`
- **resources.ts**: `Resource`, `ResourceType`
- **system.ts**: `AppTab`, `TabPermissionConfig`, `SystemConfig`, `KPICardData`

#### 기타
- **embed.ts**: `EmbedToken`, `EmbedSettings` (임베드 공유 링크)
- **departmentForm.ts**: `NewDepartmentForm`, `CategoryManagementState`

## 📝 사용 가이드

### 기본 Import 패턴 (권장)

```typescript
// ✅ 통합 import 사용 (권장)
import { UnifiedStudent, Enrollment, StaffMember } from '../types';
```

### 개별 Import 패턴 (특수한 경우)

```typescript
// ✅ 특정 모듈만 필요할 때 (허용)
import { EmbedSettings } from '../types/embed';
import { BillingRecord } from '../types/billing';
```

## 🎯 네이밍 컨벤션

### 타입/인터페이스
- **Pascal Case** 사용
- 명확한 접미사: `Record`, `Config`, `Settings`, `Data` 등
- 예: `ConsultationRecord`, `SalaryConfig`, `EmbedSettings`

### 타입 별칭 (Type Alias)
- **Pascal Case** 사용
- 용도 명시: `Type`, `Status`, `Role` 등
- 예: `UserRole`, `AttendanceStatus`, `ExamType`

### 상수
- **UPPER_SNAKE_CASE** 사용
- 예: `DAYS_OF_WEEK`, `ROLE_LABELS`, `DEFAULT_EMBED_SETTINGS`

### as const 패턴

```typescript
// ✅ 권장: 상수 객체에 as const 적용
export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  // ...
} as const;
```

## 🔍 타입 검색 팁

### 학생 관련
- 학생 기본 정보: `UnifiedStudent` (student.ts)
- 수강 정보: `Enrollment` (student.ts)
- 등록 상담: `ConsultationRecord` (consultation.ts)
- 재원생 상담: `Consultation` (consultation.ts)

### 직원 관련
- 직원 정보: `StaffMember` (staff.ts)
- 사용자 프로필: `UserProfile` (auth.ts)
- 권한: `UserRole`, `PermissionId` (auth.ts)

### 수업 관련
- 시간표 수업: `TimetableClass` (timetable.ts)
- 강사 정보: `Teacher` (timetable.ts)
- 출석: `DailyAttendanceRecord` (attendance.ts)
- 성적: `Exam`, `StudentScore` (grades.ts)

### 일정 관련
- 캘린더 이벤트: `CalendarEvent` (calendar.ts)
- 간트 차트: `GanttTemplate` (gantt.ts)

## 🚫 주의사항

### enum 사용 제한
- **원칙**: union type 우선 사용
- **예외**: `consultation.ts`의 enum은 기존 코드 호환성을 위해 유지
- **이유**: Tree-shaking 최적화

```typescript
// ❌ enum 사용 자제
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// ✅ union type 권장
export type Status = 'active' | 'inactive';

// ✅ 상수 객체 필요 시
export const STATUS = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

export type Status = typeof STATUS[keyof typeof STATUS];
```

### 타입 중복 방지
- 기존 타입 재사용 우선
- 새 타입 추가 전 검색: `Ctrl+Shift+F`로 유사 타입 확인
- 불가피한 경우에만 새 타입 정의

### Deprecated 타입
- `@deprecated` JSDoc 주석으로 표시
- 대체 타입 안내 필수

```typescript
/**
 * @deprecated Use staffId instead
 */
teacherId?: string;
```

## 📊 통계 (2026-02-06 기준)

- 총 타입 파일: **16개**
- 핵심 인터페이스: **50+ 개**
- 타입 별칭: **30+ 개**
- enum: **3개** (consultation.ts 전용)
- 중복 타입: **0개**

## 🔄 업데이트 가이드

### 새 타입 추가 시
1. 적절한 도메인 파일 선택 (또는 신규 생성)
2. 타입 정의 작성 (JSDoc 주석 포함)
3. `types/index.ts`에 export 추가
4. 이 README 업데이트

### 타입 수정 시
1. 영향 범위 확인: `Ctrl+Shift+F`로 사용처 검색
2. Breaking change 여부 판단
3. 필요시 마이그레이션 계획 수립
4. 변경 로그 작성

## 📖 참고 자료

- [TypeScript Handbook - Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Vercel React Best Practices](https://vercel.com/docs/frameworks/react)
- [프로젝트 타입 시스템 설계 문서](../docs/type-system.md) (해당 시)
