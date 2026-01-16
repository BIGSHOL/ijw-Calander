# 강사 → 직원 마이그레이션 가이드

## 개요

이 스크립트는 Firestore의 `강사목록` 컬렉션 데이터를 `staff` 컬렉션으로 마이그레이션합니다.

## 매핑 규칙

### Teacher → StaffMember 필드 매핑

| Teacher 필드 | StaffMember 필드 | 변환 규칙 |
|-------------|------------------|----------|
| `id` | `id` | 동일하게 유지 |
| `name` | `name` | 동일하게 유지 |
| `subjects` | `subjects` | string[] → ('math'\|'english')[] 변환 |
| `isHidden` | `isHiddenInTimetable` | 명확한 이름으로 변경 |
| `isNative` | `isNative` | 동일하게 유지 |
| `color` | (삭제) | 사용하지 않음 |
| `bgColor` | `bgColor` | 동일하게 유지 |
| `textColor` | `textColor` | 동일하게 유지 |
| `order` | `timetableOrder` | 명확한 이름으로 변경 |
| `defaultRoom` | `defaultRoom` | 동일하게 유지 |

### 새로 추가되는 필드 (기본값)

| 필드 | 기본값 | 설명 |
|-----|-------|------|
| `role` | `'teacher'` | 직원 역할 (고정) |
| `email` | `''` | 이메일 (나중에 입력) |
| `phone` | `''` | 전화번호 (나중에 입력) |
| `hireDate` | 오늘 날짜 | 입사일 (YYYY-MM-DD) |
| `status` | `'active'` | 재직 상태 (고정) |
| `createdAt` | 현재 시간 | 생성 시각 (ISO string) |
| `updatedAt` | 현재 시간 | 수정 시각 (ISO string) |

## 사용 방법

### 1. Dry-run (미리보기)

실제로 데이터를 변경하지 않고 마이그레이션 결과를 미리 확인합니다.

```bash
npm run migrate:teachers -- --dry-run
```

**출력 예시:**
```
=== Teacher to Staff Migration (DRY RUN) ===

Found 22 teachers in 강사목록

⏭️  Skipping: 김민주 (already exists in staff)

📊 Migration Summary:
   Total teachers: 22
   To migrate: 21
   To skip (duplicates): 1

[DRY RUN] Would migrate the following teachers:

  📝 이성우
     - Role: teacher
     - Subjects: math
     - Native: No
     - Hidden: No
     - Default Room: 3강의실
     - Colors: bg=#3b82f6, text=#ffffff

  📝 Ellen
     - Role: teacher
     - Subjects: english
     - Native: Yes
     - Hidden: No
     - Default Room: 1강의실
     - Colors: bg=#ef4444, text=#ffffff

...
```

### 2. 실제 마이그레이션 실행

```bash
npm run migrate:teachers
```

**동작:**
1. `backups/teachers-backup.json` 파일에 백업 생성
2. 중복 체크 (이름으로 체크)
3. 중복이 아닌 강사만 `staff` 컬렉션에 추가
4. 원본 `강사목록` 컬렉션은 그대로 유지

**출력 예시:**
```
=== Teacher to Staff Migration (LIVE) ===

📦 Creating backup of teachers collection...
✅ Backup created: ./backups/teachers-backup.json
   Total teachers backed up: 22

Found 22 teachers in 강사목록

⏭️  Skipping: 김민주 (already exists in staff)

📊 Migration Summary:
   Total teachers: 22
   To migrate: 21
   To skip (duplicates): 1

🚀 Starting migration...
  ✅ Migrating: 이성우
  ✅ Migrating: Ellen
  ✅ Migrating: 김은정
  ...
   Committed final batch of 21 staff members

✅ Migration complete! 21 teachers migrated to staff.

💡 Note: Original teachers collection (강사목록) is preserved.
   You can safely delete it after verifying the migration.
```

### 3. 롤백 (되돌리기)

마이그레이션이 잘못되었을 경우, staff 컬렉션에서 마이그레이션된 데이터를 삭제합니다.

```bash
npm run migrate:teachers -- --rollback
```

**동작:**
1. `backups/teachers-backup.json` 파일 확인
2. `staff` 컬렉션에서 `role='teacher'`인 모든 문서 삭제
3. 원본 `강사목록` 컬렉션은 그대로 유지

**출력 예시:**
```
=== Rollback Migration ===

📦 Backup found from: 2026-01-16T10:30:00.000Z
   Teachers in backup: 22

🔍 Finding migrated staff members...
   Found 21 staff members with role='teacher'

⚠️  This will DELETE all staff members with role="teacher"
   Original teachers collection will remain unchanged.

🗑️  Deleting migrated staff members...
  ❌ Deleting: 이성우
  ❌ Deleting: Ellen
  ❌ Deleting: 김은정
  ...

✅ Rollback complete! Deleted 21 staff members.
   Teachers collection (강사목록) remains intact.
```

## 중복 방지 로직

스크립트는 **이름(name)** 으로 중복을 체크합니다.

- 이미 `staff` 컬렉션에 동일한 이름의 직원이 있으면 스킵
- 중복된 강사는 마이그레이션하지 않고 로그에 표시

## 안전 장치

### 1. 백업
- 실제 마이그레이션 실행 시 자동으로 `backups/teachers-backup.json` 생성
- 백업에는 타임스탬프와 모든 강사 데이터 포함

### 2. 원본 보존
- **`강사목록` 컬렉션은 절대 삭제하지 않습니다**
- 마이그레이션 후 검증이 완료되면 수동으로 삭제 가능

### 3. Dry-run 모드
- 실제 데이터 변경 없이 미리보기 가능
- 항상 dry-run으로 먼저 확인하는 것을 권장

### 4. 롤백 기능
- 문제 발생 시 `--rollback` 플래그로 되돌리기 가능
- 백업 파일이 있어야 롤백 가능

## 주의사항

1. **환경 변수 확인**
   - `.env.local` 파일에 Firebase 설정이 올바른지 확인
   - `VITE_FIREBASE_*` 변수들이 모두 설정되어 있어야 함

2. **권한 확인**
   - Firestore에 읽기/쓰기 권한이 있는지 확인
   - `강사목록`과 `staff` 컬렉션에 접근 가능해야 함

3. **데이터 검증**
   - 마이그레이션 후 `staff` 컬렉션 확인
   - 강사 수, 이름, 색상 등이 올바른지 확인
   - 시간표, 출석부 등에서 정상 작동하는지 테스트

4. **백업 보관**
   - `backups/teachers-backup.json` 파일 삭제하지 말 것
   - 최소 30일간 보관 권장

## 문제 해결

### 백업 파일을 찾을 수 없습니다
```
❌ Backup file not found: ./backups/teachers-backup.json
```

**해결:**
- 마이그레이션을 한 번도 실행하지 않았거나 백업 파일이 삭제됨
- 롤백은 실제 마이그레이션 실행 후에만 가능

### Firebase 연결 오류
```
Firebase configuration error: Missing required environment variables.
```

**해결:**
- `.env.local` 파일 확인
- 모든 `VITE_FIREBASE_*` 변수가 설정되어 있는지 확인

### 중복된 강사가 스킵됩니다
```
⏭️  Skipping: 김민주 (already exists in staff)
```

**해결:**
- 정상적인 동작입니다
- 이미 `staff` 컬렉션에 존재하는 강사는 중복 방지를 위해 스킵됨
- 필요시 `staff` 컬렉션에서 해당 직원을 먼저 삭제 후 재실행

## 다음 단계

마이그레이션 완료 후:

1. **검증**
   - Firebase Console에서 `staff` 컬렉션 확인
   - 22명의 강사가 모두 마이그레이션되었는지 확인
   - `role='teacher'` 필드가 올바른지 확인

2. **테스트**
   - 시간표에서 강사 표시 확인
   - 수업 관리에서 강사 선택 확인
   - 출석부에서 강사 필터 확인

3. **코드 업데이트**
   - `useTeachers` 훅을 `useStaff` 훅으로 교체
   - 필드명 변경 반영 (`isHidden` → `isHiddenInTimetable`, `order` → `timetableOrder`)

4. **레거시 정리** (검증 완료 후)
   - `강사목록` 컬렉션 삭제 (최소 30일 후)
   - `useTeachers` 훅 deprecated 처리

## 참고 문서

- [Teacher to Staff 통합 계획서](../reports/teacher-to-staff-migration-plan-2026-01-16.md)
- [StaffMember 인터페이스](../types.ts) (line 1300-1328)
- [Teacher 인터페이스](../types.ts) (line 680-691)
