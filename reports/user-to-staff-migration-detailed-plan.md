# 사용자 관리 → 직원 관리 통합 구현 계획서

> **문서명**: 사용자 관리를 직원 관리로 통합하는 상세 구현 계획
> **분석일**: 2026-01-16
> **작성자**: Claude AI Assistant
> **총평 점수**: ⭐⭐⭐⭐☆ (4/5) - 명확한 요구사항, 일부 설계 복잡도 존재

---

## 📊 Executive Summary

### 3줄 요약
1. **현재 상황**: 사용자 관리(UserProfile)와 직원 관리(StaffMember)가 별도 시스템으로 분리되어 데이터 중복 및 관리 복잡도 증가
2. **목표**: 승인 대기, 권한 설정, 부서 배정 등 사용자 관리의 모든 기능을 직원 관리로 통합하여 단일 진실 공급원(Single Source of Truth) 구축
3. **예상 효과**: 데이터 일관성 확보, UI/UX 단순화, 관리 효율성 30% 향상

### 전체 평가

| 항목 | 점수 | 평가 |
|------|------|------|
| 요구사항 명확성 | ⭐⭐⭐⭐⭐ | 매우 명확한 요구사항 |
| 기술적 복잡도 | ⭐⭐⭐☆☆ | 중간 수준 (타입 통합, 데이터 마이그레이션) |
| 데이터 일관성 리스크 | ⭐⭐⭐⭐☆ | 마이그레이션 스크립트로 관리 가능 |
| UI/UX 영향도 | ⭐⭐⭐⭐☆ | 대규모 UI 변경 필요 |
| 실행 가능성 | ⭐⭐⭐⭐⭐ | 단계별 구현 가능 |

---

## 🔍 상세 분석

## 1. 현황 분석 (As-Is)

### 1.1 UserProfile 타입 (설정 - 사용자 관리)

**위치**: `types.ts` (615-641줄)

```typescript
export interface UserProfile {
  uid: string;                          // Firebase Auth UID
  email: string;
  role: UserRole;                       // 8단계 역할 (master, admin, manager 등)
  status: 'approved' | 'pending' | 'rejected';  // ✅ 승인 상태

  // 권한 관리
  departmentPermissions?: Record<string, 'view' | 'edit'>;  // ✅ 부서별 권한
  favoriteDepartments?: string[];
  departmentId?: string;                // ✅ 소속 부서

  // 프로필 정보
  displayName?: string;
  jobTitle?: string;                    // ✅ 호칭

  // 시간표 연동
  teacherId?: string;                   // 강사목록 컬렉션 연결

  // 레거시 (deprecated)
  allowedDepartments?: string[];
  canEdit?: boolean;
  canManageMenus?: boolean;
  canManageEventAuthors?: boolean;
}
```

**Firestore 컬렉션**: `users`
**관리 UI**: `components/Settings/tabs/UsersTab.tsx`

**주요 기능**:
- ✅ 승인 대기(pending) / 승인(approved) / 차단(rejected) 상태 관리
- ✅ 역할(Role) 변경 (master, admin, manager 등)
- ✅ 부서별 권한 설정 (view/edit)
- ✅ 강사 프로필 연동 (teacherId)
- ✅ 일정 조회 기능 (사용자별 이벤트 목록)

### 1.2 StaffMember 타입 (직원 관리)

**위치**: `types.ts` (1301-1330줄)

```typescript
export interface StaffMember {
  id: string;
  userId?: string;                      // ❌ users 컬렉션 연동 (현재 미사용)

  // 기본 정보
  name: string;
  englishName?: string;
  email: string;
  phone?: string;

  // 역할 및 상태
  role: 'teacher' | 'admin' | 'staff';  // ❌ UserProfile의 role과 불일치
  status: 'active' | 'inactive' | 'resigned';  // ❌ UserProfile의 status와 불일치
  subjects?: ('math' | 'english')[];

  // 근무 정보
  hireDate: string;
  workSchedule?: WeeklySchedule;
  profileImage?: string;
  memo?: string;

  // 시간표 전용 (role === 'teacher')
  isHiddenInTimetable?: boolean;
  isNative?: boolean;
  bgColor?: string;
  textColor?: string;
  defaultRoom?: string;
  timetableOrder?: number;

  // 메타데이터
  createdAt: string;
  updatedAt: string;
}
```

**Firestore 컬렉션**: `staff`
**관리 UI**: `components/Staff/StaffList.tsx`, `StaffForm.tsx`

**주요 기능**:
- ✅ 직원 CRUD (생성, 수정, 삭제)
- ✅ 상태 관리 (재직, 휴직, 퇴사)
- ✅ 시간표 색상 설정 (강사 전용)
- ✅ 과목별 필터링
- ❌ 승인 대기 기능 없음
- ❌ 권한 설정 기능 없음
- ❌ 부서 배정 기능 없음

### 1.3 데이터 중복 및 불일치 문제

#### 문제 1: 역할(Role) 체계 불일치
```typescript
// UserProfile: 8단계 세밀한 권한
type UserRole = 'master' | 'admin' | 'manager' | 'math_lead' | 'english_lead'
              | 'math_teacher' | 'english_teacher' | 'user';

// StaffMember: 3단계 간단한 구분
role: 'teacher' | 'admin' | 'staff';
```

#### 문제 2: 상태(Status) 의미 불일치
```typescript
// UserProfile: 시스템 접근 승인 상태
status: 'approved' | 'pending' | 'rejected';

// StaffMember: 재직 상태
status: 'active' | 'inactive' | 'resigned';
```

#### 문제 3: 데이터 동기화 이슈
- `UserProfile.teacherId` → `Teacher.id` 연결 존재
- `StaffMember.userId` 필드는 선언되어 있으나 **실제 사용되지 않음**
- 동일 인물에 대해 두 컬렉션에 별도 레코드 관리 필요

---

## 2. 목표 아키텍처 (To-Be)

### 2.1 통합 타입 설계: ExtendedStaffMember

```typescript
/**
 * 통합 직원 관리 타입
 * - 기존 StaffMember의 모든 필드 유지
 * - UserProfile의 권한 관리 필드 추가
 */
export interface ExtendedStaffMember extends Omit<StaffMember, 'status'> {
  // === UserProfile에서 가져올 필드 ===
  uid?: string;                         // Firebase Auth UID (선택적)
  systemRole: UserRole;                 // 시스템 권한 역할 (8단계)
  approvalStatus: 'approved' | 'pending' | 'rejected';  // 승인 상태
  departmentPermissions?: Record<string, 'view' | 'edit'>;  // 부서별 권한
  favoriteDepartments?: string[];       // 즐겨찾기 부서
  primaryDepartmentId?: string;         // 주 소속 부서

  // === 기존 StaffMember 필드 재정의 ===
  employmentStatus: 'active' | 'inactive' | 'resigned';  // 재직 상태 (기존 status)

  // === 통합 정보 ===
  accountLinked: boolean;               // Firebase Auth 계정 연동 여부
  lastLogin?: string;                   // 마지막 로그인 시각

  // === 레거시 호환성 ===
  _migratedFrom?: 'users' | 'staff';    // 마이그레이션 출처
  _originalUserId?: string;             // 원본 users 문서 ID
}
```

### 2.2 필드 매핑 전략

| UserProfile 필드 | StaffMember 필드 | 통합 필드 | 변환 로직 |
|-----------------|-----------------|----------|----------|
| `uid` | - | `uid` | 그대로 복사 |
| `email` | `email` | `email` | 일치 (키 필드) |
| `role` | `role` | `systemRole` | 8단계 → 8단계 유지 |
| - | `role` | `staffType` | 'teacher'/'admin'/'staff' 유지 |
| `status` | `status` | `approvalStatus` / `employmentStatus` | 분리 관리 |
| `jobTitle` | - | `jobTitle` | UserProfile 우선 |
| `displayName` | `name` | `name` | StaffMember 우선 |
| `departmentPermissions` | - | `departmentPermissions` | 그대로 복사 |
| `departmentId` | - | `primaryDepartmentId` | 그대로 복사 |
| `teacherId` | `id` | `teacherId` | 강사목록 연결 유지 |

### 2.3 Firestore 컬렉션 구조

#### 옵션 A: 단일 컬렉션 통합 (권장)
```
staff/
  ├─ {staffId1}/
  │   ├─ uid: "firebase_auth_uid_123"
  │   ├─ email: "teacher@example.com"
  │   ├─ systemRole: "math_teacher"
  │   ├─ approvalStatus: "approved"
  │   ├─ employmentStatus: "active"
  │   ├─ departmentPermissions: { "math": "edit", "english": "view" }
  │   └─ ...
  └─ {staffId2}/
      └─ ...
```

**장점**:
- ✅ 단일 진실 공급원
- ✅ 데이터 일관성 보장
- ✅ 쿼리 성능 우수

**단점**:
- ❌ 대규모 마이그레이션 필요
- ❌ 기존 코드 전면 수정

#### 옵션 B: 이중 컬렉션 유지 + 동기화 (과도기)
```
users/ (Firebase Auth 전용)
  └─ {uid}/
      ├─ staffId: "ref_to_staff_collection"
      └─ approvalStatus: "approved"

staff/ (직원 마스터 데이터)
  └─ {staffId}/
      ├─ uid: "firebase_auth_uid"
      ├─ systemRole: "math_teacher"
      └─ ...
```

**장점**:
- ✅ 점진적 마이그레이션 가능
- ✅ 기존 시스템 최소 영향

**단점**:
- ❌ 동기화 로직 복잡
- ❌ 데이터 불일치 가능성

**권장 방안**: **옵션 A (단일 컬렉션)** + 단계적 마이그레이션

---

## 3. UI/UX 통합 계획

### 3.1 직원 관리 페이지 강화

#### 현재 StaffList.tsx 기능
```typescript
// 기본 직원 목록 표시
- 이름, 직책, 연락처, 담당과목
- 시간표 정보 (색상, 강의실)
- 입사일, 상태
- 수정/삭제 작업
```

#### 추가 필요 기능 (UsersTab.tsx 기능 통합)
```typescript
// ✅ 1. 승인 대기 탭 분리
- 탭 1: 정회원 (approved)
- 탭 2: 승인 대기 (pending)

// ✅ 2. 승인 상태 표시 및 변경
- 승인됨 (녹색) / 대기중 (노란색) / 차단됨 (회색)
- 승인 버튼: pending → approved
- 차단 버튼: approved → rejected

// ✅ 3. 역할(Role) 변경
- 드롭다운: master, admin, manager, math_lead, 영어팀장 등
- 권한 검증: Master만 Master 편집 가능

// ✅ 4. 권한 설정 버튼
- UserDetailModal 연동
- 부서별 view/edit 권한 설정
- 강사 프로필 연동

// ✅ 5. 일정 보기 기능
- MyEventsModal 연동
- 해당 직원의 캘린더 이벤트 조회
```

### 3.2 StaffForm.tsx 확장

#### 기존 폼 필드
```typescript
- 이름, 영어 이름
- 이메일, 전화번호
- 직책 (teacher/admin/staff)
- 담당 과목
- 입사일
- 상태 (재직/휴직/퇴사)
- 시간표 설정 (색상, 강의실, 원어민 여부)
- 메모
```

#### 추가 폼 필드
```typescript
// 1. 시스템 권한 섹션
- 시스템 역할: <select> master/admin/manager/...
- 승인 상태: <select> approved/pending/rejected
- 주 소속 부서: <select> 부서 목록

// 2. Firebase Auth 연동 섹션
- [ ] Firebase 계정 생성
  - 임시 비밀번호 자동 생성
  - 이메일로 비밀번호 재설정 링크 발송
- 계정 연동 상태: ✅ 연동됨 / ❌ 미연동

// 3. 부서별 권한 (고급 설정 - 접기/펼치기)
- [부서1] view / edit / none
- [부서2] view / edit / none
- ...
```

### 3.3 새로운 통합 UI 구조

```
직원 관리 페이지 (StaffManagement)
├─ 상단 탭
│   ├─ 정회원 (badge: 승인된 인원 수)
│   └─ 승인 대기 (badge: 대기중 인원 수 + 빨간 점)
│
├─ 검색 및 필터
│   ├─ 이름/이메일 검색
│   ├─ 역할 필터 (전체/강사/관리자/직원)
│   ├─ 과목 필터 (전체/수학/영어)
│   └─ 상태 필터 (재직/휴직/퇴사)
│
├─ 직원 목록 테이블
│   ├─ 열: 이름 | 역할 | 승인상태 | 재직상태 | 담당과목 | 입사일 | 작업
│   └─ 행 클릭 → StaffDetailModal
│
└─ 액션 버튼
    ├─ + 직원 추가
    └─ ⚙️ 설정
```

### 3.4 StaffDetailModal (신규 통합 모달)

```typescript
interface StaffDetailModalProps {
  staff: ExtendedStaffMember;
  onClose: () => void;
  onUpdate: (updates: Partial<ExtendedStaffMember>) => Promise<void>;
}

// 모달 구조
<StaffDetailModal>
  {/* 헤더 */}
  <Header>
    <Avatar /> {staff.name}
    <RoleBadge /> <ApprovalStatusBadge />
  </Header>

  {/* 탭 네비게이션 */}
  <Tabs>
    <Tab label="기본 정보" />
    <Tab label="시스템 권한" />
    <Tab label="시간표 설정" />
    <Tab label="일정 보기" />
  </Tabs>

  {/* 기본 정보 탭 */}
  <TabPanel id="basic">
    <Input label="이름" value={staff.name} />
    <Input label="이메일" value={staff.email} />
    <Input label="전화번호" value={staff.phone} />
    <Select label="재직 상태" value={staff.employmentStatus} />
    <DatePicker label="입사일" value={staff.hireDate} />
  </TabPanel>

  {/* 시스템 권한 탭 */}
  <TabPanel id="permissions">
    <Select label="시스템 역할" value={staff.systemRole} />
    <Select label="승인 상태" value={staff.approvalStatus} />
    <Select label="주 소속 부서" value={staff.primaryDepartmentId} />

    <DepartmentPermissionsGrid>
      {departments.map(dept => (
        <DepartmentRow>
          <DeptLabel>{dept.name}</DeptLabel>
          <SegmentedControl options={['none', 'view', 'edit']} />
        </DepartmentRow>
      ))}
    </DepartmentPermissionsGrid>

    <TeacherProfileLinking>
      <Select label="강사 프로필 연동" value={staff.teacherId} />
    </TeacherProfileLinking>
  </TabPanel>

  {/* 시간표 설정 탭 (강사 전용) */}
  <TabPanel id="timetable" visible={staff.staffType === 'teacher'}>
    <ColorPicker label="배경색" value={staff.bgColor} />
    <ColorPicker label="글자색" value={staff.textColor} />
    <Input label="기본 강의실" value={staff.defaultRoom} />
    <Checkbox label="원어민 강사" checked={staff.isNative} />
    <Checkbox label="시간표에서 숨김" checked={staff.isHiddenInTimetable} />
  </TabPanel>

  {/* 일정 보기 탭 */}
  <TabPanel id="events">
    <MyEventsModal user={staff} embedded />
  </TabPanel>

  {/* 푸터 */}
  <Footer>
    <DeleteButton /> <SaveButton />
  </Footer>
</StaffDetailModal>
```

---

## 4. 데이터 마이그레이션 전략

### 4.1 마이그레이션 시나리오

#### Phase 1: 스키마 확장 (비파괴적)
```typescript
// 1. staff 컬렉션에 새 필드 추가 (기존 데이터 유지)
const migration_phase1 = async () => {
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const batch = writeBatch(db);

  staffSnapshot.forEach((doc) => {
    const staff = doc.data() as StaffMember;

    batch.update(doc.ref, {
      // 신규 필드 추가 (기본값)
      systemRole: 'user',              // 기본 역할
      approvalStatus: 'approved',       // 기존 직원은 승인됨
      employmentStatus: staff.status,   // 기존 status → employmentStatus
      departmentPermissions: {},        // 빈 권한
      primaryDepartmentId: null,        // 미배정
      accountLinked: false,             // 미연동
      _migratedFrom: 'staff',
    });
  });

  await batch.commit();
};
```

#### Phase 2: UserProfile 데이터 병합
```typescript
// 2. users 컬렉션의 데이터를 staff로 병합
const migration_phase2 = async () => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const batch = writeBatch(db);

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data() as UserProfile;

    // 이메일로 staff 문서 찾기
    const staffQuery = query(
      collection(db, 'staff'),
      where('email', '==', user.email)
    );
    const staffSnapshot = await getDocs(staffQuery);

    if (staffSnapshot.empty) {
      // 신규 staff 문서 생성 (users 컬렉션에만 존재하는 경우)
      const newStaffRef = doc(collection(db, 'staff'));
      batch.set(newStaffRef, {
        // UserProfile 기반 staff 생성
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        systemRole: user.role,
        approvalStatus: user.status,
        employmentStatus: 'active',
        departmentPermissions: user.departmentPermissions || {},
        primaryDepartmentId: user.departmentId,
        hireDate: new Date().toISOString().split('T')[0],
        role: 'staff',  // 기본 직원 타입
        status: 'active',
        accountLinked: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _migratedFrom: 'users',
        _originalUserId: user.uid,
      });
    } else {
      // 기존 staff 문서 업데이트 (병합)
      const staffDoc = staffSnapshot.docs[0];
      batch.update(staffDoc.ref, {
        uid: user.uid,
        systemRole: user.role,
        approvalStatus: user.status,
        departmentPermissions: user.departmentPermissions || {},
        primaryDepartmentId: user.departmentId,
        jobTitle: user.jobTitle,
        teacherId: user.teacherId,
        accountLinked: true,
        _migratedFrom: 'merged',
        _originalUserId: user.uid,
      });
    }
  }

  await batch.commit();
};
```

#### Phase 3: 검증 및 롤백 준비
```typescript
// 3. 마이그레이션 검증
const migration_phase3_verify = async () => {
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const usersSnapshot = await getDocs(collection(db, 'users'));

  const report = {
    totalStaff: staffSnapshot.size,
    totalUsers: usersSnapshot.size,
    linkedAccounts: 0,
    unlinkedAccounts: 0,
    missingData: [] as string[],
  };

  staffSnapshot.forEach((doc) => {
    const staff = doc.data();
    if (staff.accountLinked) {
      report.linkedAccounts++;
    } else {
      report.unlinkedAccounts++;
    }

    // 필수 필드 검증
    if (!staff.systemRole || !staff.approvalStatus) {
      report.missingData.push(doc.id);
    }
  });

  console.log('Migration Report:', report);
  return report;
};

// 4. 롤백 스크립트 (필요시)
const migration_rollback = async () => {
  const staffSnapshot = await getDocs(
    query(collection(db, 'staff'), where('_migratedFrom', '!=', null))
  );
  const batch = writeBatch(db);

  staffSnapshot.forEach((doc) => {
    const staff = doc.data();

    if (staff._migratedFrom === 'users') {
      // users에서만 생성된 문서는 삭제
      batch.delete(doc.ref);
    } else {
      // 병합된 문서는 추가 필드만 제거
      batch.update(doc.ref, {
        systemRole: deleteField(),
        approvalStatus: deleteField(),
        departmentPermissions: deleteField(),
        // ...
      });
    }
  });

  await batch.commit();
};
```

### 4.2 마이그레이션 UI (MigrationTab)

```typescript
// components/Settings/MigrationTab.tsx 확장
<MigrationSection title="직원 관리 통합 마이그레이션">
  <Step number={1} title="스키마 확장">
    <StatusBadge status={phase1Status} />
    <ActionButton onClick={runPhase1}>
      Phase 1 실행: 필드 추가
    </ActionButton>
    <Details>
      - staff 컬렉션에 systemRole, approvalStatus 등 추가
      - 기존 데이터 영향 없음 (안전)
    </Details>
  </Step>

  <Step number={2} title="데이터 병합">
    <StatusBadge status={phase2Status} />
    <ActionButton onClick={runPhase2}>
      Phase 2 실행: users → staff 병합
    </ActionButton>
    <Details>
      - 이메일 기준 매칭
      - 신규 staff 생성 또는 기존 staff 업데이트
    </Details>
    <WarningBox>
      주의: 이 단계는 데이터를 수정합니다. 백업 권장.
    </WarningBox>
  </Step>

  <Step number={3} title="검증">
    <StatusBadge status={phase3Status} />
    <ActionButton onClick={runVerification}>
      검증 실행
    </ActionButton>
    <ReportView>
      {verificationReport && (
        <Table>
          <Row>총 직원: {verificationReport.totalStaff}</Row>
          <Row>연동된 계정: {verificationReport.linkedAccounts}</Row>
          <Row>미연동 계정: {verificationReport.unlinkedAccounts}</Row>
          <Row>누락 데이터: {verificationReport.missingData.length}</Row>
        </Table>
      )}
    </ReportView>
  </Step>

  <Step number={4} title="롤백 (필요시)">
    <DangerButton onClick={runRollback}>
      ⚠️ 롤백 실행 (원상 복구)
    </DangerButton>
  </Step>
</MigrationSection>
```

---

## 5. 구현 우선순위 및 로드맵

### Phase 1: 준비 (1-2일)
- [ ] ExtendedStaffMember 타입 정의
- [ ] 필드 매핑 테이블 문서화
- [ ] 마이그레이션 스크립트 작성
- [ ] 테스트 데이터 생성

### Phase 2: 백엔드 마이그레이션 (2-3일)
- [ ] staff 컬렉션 스키마 확장
- [ ] users → staff 데이터 병합
- [ ] 마이그레이션 검증
- [ ] useStaff 훅 업데이트
  - 승인 상태 필터링
  - 역할별 정렬
  - 부서별 필터링

### Phase 3: UI 통합 (3-4일)
- [ ] StaffList 컴포넌트 확장
  - 승인 대기 탭 추가
  - 승인 상태 표시
  - 역할 변경 드롭다운
- [ ] StaffForm 확장
  - 시스템 권한 섹션
  - 부서별 권한 설정
  - Firebase Auth 연동 옵션
- [ ] StaffDetailModal 신규 개발
  - 탭 네비게이션
  - 권한 설정 그리드
  - 일정 보기 연동

### Phase 4: 부서 설정 이동 (1일)
- [ ] DepartmentsTab을 연간 일정 탭 설정으로 이동
- [ ] SettingsModal 탭 구조 재구성
- [ ] 네비게이션 업데이트

### Phase 5: SettingsModal 정리 (1일)
- [ ] 사용자 관리 탭 제거
- [ ] UsersTab.tsx 아카이브 (참고용)
- [ ] UserDetailModal.tsx 삭제
- [ ] 관련 imports 정리

### Phase 6: 테스트 및 검증 (2일)
- [ ] 단위 테스트
  - useStaff 훅
  - 마이그레이션 스크립트
- [ ] 통합 테스트
  - 승인 플로우
  - 권한 설정 플로우
  - 부서 배정 플로우
- [ ] 사용자 수용 테스트 (UAT)

### Phase 7: 배포 및 모니터링 (1일)
- [ ] 프로덕션 마이그레이션 실행
- [ ] 사용자 가이드 작성
- [ ] 모니터링 설정
- [ ] 롤백 준비

**총 예상 기간**: 11-14일

---

## 6. 리스크 관리

### 리스크 1: 데이터 손실
**확률**: 🟡 중간
**영향도**: 🔴 높음

**완화 방안**:
- ✅ 마이그레이션 전 전체 Firestore 백업
- ✅ 단계별 검증 스크립트
- ✅ 롤백 스크립트 사전 테스트
- ✅ 개발 환경에서 먼저 실행

### 리스크 2: 권한 체계 충돌
**확률**: 🟢 낮음
**영향도**: 🟡 중간

**완화 방안**:
- ✅ systemRole과 staffType 명확히 분리
- ✅ DEFAULT_ROLE_PERMISSIONS 유지
- ✅ Master 역할 최우선 보장

### 리스크 3: UI/UX 혼란
**확률**: 🟡 중간
**영향도**: 🟡 중간

**완화 방안**:
- ✅ 사용자 교육 자료 제공
- ✅ 안내 모달 (첫 로그인 시)
- ✅ 기존 용어 최대한 유지

### 리스크 4: 성능 저하
**확률**: 🟢 낮음
**영향도**: 🟢 낮음

**완화 방안**:
- ✅ 인덱스 최적화 (email, systemRole, approvalStatus)
- ✅ 페이지네이션 유지
- ✅ 쿼리 캐싱 (React Query)

---

## 7. 체크리스트

### 구현 전 확인사항
- [ ] 모든 이해관계자 승인
- [ ] Firestore 백업 완료
- [ ] 테스트 환경 준비
- [ ] 롤백 계획 수립

### 마이그레이션 체크리스트
- [ ] Phase 1: 스키마 확장 완료
- [ ] Phase 2: 데이터 병합 완료
- [ ] Phase 3: 검증 통과 (100% 매칭)
- [ ] 기존 users 컬렉션 읽기 전용으로 전환
- [ ] 마이그레이션 로그 저장

### UI 통합 체크리스트
- [ ] 승인 대기 탭 동작 확인
- [ ] 역할 변경 권한 테스트
- [ ] 부서별 권한 설정 테스트
- [ ] 강사 프로필 연동 테스트
- [ ] 일정 보기 기능 테스트
- [ ] 모바일 반응형 확인

### 배포 후 확인사항
- [ ] 모든 기존 사용자 로그인 가능
- [ ] 권한 설정 정상 동작
- [ ] 승인 플로우 정상 동작
- [ ] 성능 지표 정상 범위
- [ ] 오류 로그 모니터링

---

## 8. 코드 예시

### 8.1 useStaff 훅 확장

```typescript
// hooks/useStaff.ts
export function useStaff() {
  const queryClient = useQueryClient();

  const {
    data: staff = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ExtendedStaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const q = query(
        collection(db, 'staff'),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ExtendedStaffMember));
    },
    staleTime: 1000 * 60 * 5,
  });

  // ✅ 승인 상태별 필터링
  const approvedStaff = useMemo(
    () => staff.filter(s => s.approvalStatus === 'approved'),
    [staff]
  );

  const pendingStaff = useMemo(
    () => staff.filter(s => s.approvalStatus === 'pending'),
    [staff]
  );

  // ✅ 승인 처리
  const approveStaff = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'staff', id), {
      approvalStatus: 'approved',
      updatedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  }, [queryClient]);

  // ✅ 역할 변경
  const updateRole = useCallback(async (id: string, role: UserRole) => {
    await updateDoc(doc(db, 'staff', id), {
      systemRole: role,
      updatedAt: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  }, [queryClient]);

  return {
    staff,
    approvedStaff,
    pendingStaff,
    isLoading,
    error,
    approveStaff,
    updateRole,
    refetch,
  };
}
```

### 8.2 StaffList 컴포넌트 확장

```typescript
// components/Staff/StaffList.tsx
const StaffList: React.FC<StaffListProps> = ({ ... }) => {
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');

  const filteredStaff = useMemo(() => {
    return staff.filter(s =>
      activeTab === 'approved'
        ? s.approvalStatus === 'approved'
        : s.approvalStatus === 'pending'
    );
  }, [staff, activeTab]);

  return (
    <div>
      {/* ✅ 탭 네비게이션 */}
      <div className="flex gap-4 mb-4 border-b">
        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-2 px-1 text-sm font-bold ${
            activeTab === 'approved' ? 'border-b-2 border-blue-500' : ''
          }`}
        >
          정회원
          <span className="ml-2 bg-blue-100 px-2 py-0.5 rounded-full text-xs">
            {staff.filter(s => s.approvalStatus === 'approved').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-1 text-sm font-bold ${
            activeTab === 'pending' ? 'border-b-2 border-yellow-500' : ''
          }`}
        >
          승인 대기
          <span className="ml-2 bg-yellow-100 px-2 py-0.5 rounded-full text-xs">
            {staff.filter(s => s.approvalStatus === 'pending').length}
          </span>
        </button>
      </div>

      {/* 테이블 헤더 확장 */}
      <thead>
        <tr>
          <th>이름</th>
          <th>역할</th>
          <th>✅ 승인 상태</th>  {/* 신규 */}
          <th>재직 상태</th>
          <th>담당과목</th>
          <th>작업</th>
        </tr>
      </thead>

      {/* 테이블 바디 */}
      <tbody>
        {filteredStaff.map(member => (
          <tr key={member.id}>
            <td>{member.name}</td>
            <td>
              {/* ✅ 역할 변경 드롭다운 */}
              <select
                value={member.systemRole}
                onChange={(e) => onUpdateRole(member.id, e.target.value)}
                disabled={!canChangeRole}
              >
                {getAssignableRoles(currentUserRole).map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </td>
            <td>
              {/* ✅ 승인 상태 뱃지 */}
              <span className={`px-2 py-1 rounded text-xs ${
                member.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                member.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {member.approvalStatus === 'approved' ? '승인됨' :
                 member.approvalStatus === 'pending' ? '대기중' : '차단됨'}
              </span>
            </td>
            <td>
              {getStatusBadge(member.employmentStatus)}
            </td>
            <td>
              {member.subjects?.map(s => <Badge key={s}>{s}</Badge>)}
            </td>
            <td>
              {/* ✅ 권한 설정 버튼 */}
              <button onClick={() => onOpenPermissions(member)}>
                <UserCog size={16} /> 권한
              </button>
              {/* ✅ 일정 보기 버튼 */}
              <button onClick={() => onViewEvents(member)}>
                <Calendar size={16} /> 일정
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </div>
  );
};
```

### 8.3 부서 설정 이동

```typescript
// components/Calendar/CalendarSettingsModal.tsx (신규)
const CalendarSettingsModal: React.FC = () => {
  return (
    <Modal title="연간 일정 설정">
      <Tabs>
        <Tab label="부서 관리">
          {/* ✅ 기존 DepartmentsTab 컴포넌트 재사용 */}
          <DepartmentsManagementTab
            localDepartments={departments}
            // ... props
          />
        </Tab>
        <Tab label="공휴일 관리">
          <HolidaysTab holidays={holidays} />
        </Tab>
        <Tab label="해시태그">
          <HashtagsTab />
        </Tab>
      </Tabs>
    </Modal>
  );
};
```

---

## 9. 예상 효과

### 정량적 효과
- **데이터 일관성**: 100% (단일 진실 공급원)
- **관리 효율성**: +30% (중복 작업 제거)
- **쿼리 성능**: 변화 없음 (적절한 인덱싱)
- **코드 복잡도**: -20% (두 시스템 통합)

### 정성적 효과
- ✅ 사용자 경험 개선 (일관된 UI/UX)
- ✅ 신규 직원 등록 플로우 단순화
- ✅ 권한 관리 가시성 향상
- ✅ 유지보수 비용 절감

---

## 10. 참고 자료

### 관련 파일
- `types.ts` (615-641, 1301-1330줄)
- `components/Settings/tabs/UsersTab.tsx`
- `components/Settings/modals/UserDetailModal.tsx`
- `components/Staff/StaffList.tsx`
- `components/Staff/StaffForm.tsx`
- `hooks/useStaff.ts`

### 기술 문서
- [Firestore 데이터 마이그레이션 가이드](https://firebase.google.com/docs/firestore/manage-data/migrate)
- [React Query 캐시 전략](https://tanstack.com/query/latest/docs/framework/react/guides/caching)

### 이슈 트래킹
- 마이그레이션 진행 상황: `reports/migration-progress.md`
- 버그 리포트: GitHub Issues

---

## 11. 결론

### 최종 평가
이 통합 작업은 **중간 수준의 기술적 복잡도**를 가지고 있으나, **단계별 접근**을 통해 안전하게 구현 가능합니다.

### 핵심 성공 요인
1. ✅ **철저한 백업 및 검증**: 데이터 손실 방지
2. ✅ **점진적 마이그레이션**: 단계별 롤백 가능
3. ✅ **명확한 필드 매핑**: 혼란 최소화
4. ✅ **사용자 커뮤니케이션**: 변경 사항 사전 공지

### 권장 사항
- **즉시 시작 가능**: 요구사항이 명확하고 구조가 잘 설계됨
- **우선순위 높음**: 데이터 일관성 확보는 시스템 안정성의 핵심
- **팀 협업 필수**: 백엔드, 프론트엔드, QA 협력 필요

### 다음 단계
1. 이 리포트를 팀과 검토
2. 마이그레이션 일정 확정
3. Phase 1 스크립트 작성 시작
4. 테스트 환경에서 먼저 실행

---

**문서 끝**
