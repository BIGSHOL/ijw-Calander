# 마이그레이션 스크립트 사용 예시

## 기본 사용법

### 1. Dry-run으로 미리보기

```bash
npm run migrate:teachers -- --dry-run
```

**예상 출력:**

```
=== Teacher to Staff Migration (DRY RUN) ===

Found 22 teachers in 강사목록

📊 Migration Summary:
   Total teachers: 22
   To migrate: 22
   To skip (duplicates): 0

[DRY RUN] Would migrate the following teachers:

  📝 김민주
     - Role: teacher
     - Subjects: math
     - Native: No
     - Hidden: No
     - Default Room: 3강의실
     - Colors: bg=#3b82f6, text=#ffffff

  📝 이성우
     - Role: teacher
     - Subjects: math
     - Native: No
     - Hidden: No
     - Default Room: 2강의실
     - Colors: bg=#10b981, text=#ffffff

  📝 Ellen
     - Role: teacher
     - Subjects: english
     - Native: Yes
     - Hidden: No
     - Default Room: 1강의실
     - Colors: bg=#ef4444, text=#ffffff

  ... (총 22명)

💡 To execute the migration, run without --dry-run flag:
   npm run migrate:teachers
```

---

### 2. 실제 마이그레이션 실행

```bash
npm run migrate:teachers
```

**예상 출력:**

```
=== Teacher to Staff Migration (LIVE) ===

📦 Creating backup of teachers collection...
✅ Backup created: ./backups/teachers-backup.json
   Total teachers backed up: 22

Found 22 teachers in 강사목록

📊 Migration Summary:
   Total teachers: 22
   To migrate: 22
   To skip (duplicates): 0

🚀 Starting migration...
  ✅ Migrating: 김민주
  ✅ Migrating: 이성우
  ✅ Migrating: Ellen
  ✅ Migrating: 김은정
  ✅ Migrating: 이희영
  ✅ Migrating: 윤서영
  ✅ Migrating: 이승아
  ✅ Migrating: 김윤하
  ... (총 22명)
   Committed final batch of 22 staff members

✅ Migration complete! 22 teachers migrated to staff.

💡 Note: Original teachers collection (강사목록) is preserved.
   You can safely delete it after verifying the migration.
```

---

### 3. 롤백 (마이그레이션 되돌리기)

```bash
npm run migrate:teachers -- --rollback
```

**예상 출력:**

```
=== Rollback Migration ===

📦 Backup found from: 2026-01-16T10:30:45.123Z
   Teachers in backup: 22

🔍 Finding migrated staff members...
   Found 22 staff members with role='teacher'

⚠️  This will DELETE all staff members with role="teacher"
   Original teachers collection will remain unchanged.

🗑️  Deleting migrated staff members...
  ❌ Deleting: 김민주
  ❌ Deleting: 이성우
  ❌ Deleting: Ellen
  ... (총 22명)

✅ Rollback complete! Deleted 22 staff members.
   Teachers collection (강사목록) remains intact.
```

---

## 중복 발생 시나리오

만약 일부 강사가 이미 `staff` 컬렉션에 존재한다면:

```bash
npm run migrate:teachers -- --dry-run
```

**출력:**

```
=== Teacher to Staff Migration (DRY RUN) ===

Found 22 teachers in 강사목록

⏭️  Skipping: 김민주 (already exists in staff)
⏭️  Skipping: Ellen (already exists in staff)

📊 Migration Summary:
   Total teachers: 22
   To migrate: 20
   To skip (duplicates): 2

[DRY RUN] Would migrate the following teachers:

  📝 이성우
     - Role: teacher
     ...

  ... (총 20명)
```

---

## 에러 시나리오

### Firebase 연결 실패

```bash
npm run migrate:teachers
```

**출력:**

```
=== Teacher to Staff Migration (LIVE) ===

❌ Migration error: Firebase configuration error: Missing required environment variables.
Please ensure .env.local file exists with all VITE_FIREBASE_* variables.
```

**해결:**
1. `.env.local` 파일 확인
2. 모든 `VITE_FIREBASE_*` 변수 설정 확인

---

### 백업 파일 없음 (롤백 시)

```bash
npm run migrate:teachers -- --rollback
```

**출력:**

```
=== Rollback Migration ===

❌ Backup file not found: ./backups/teachers-backup.json
Cannot proceed with rollback.
```

**해결:**
1. 마이그레이션을 한 번도 실행하지 않았음
2. 백업 파일이 삭제되었음
3. 원본 `강사목록` 컬렉션은 그대로 유지되므로 걱정 없음

---

## 백업 파일 구조

`backups/teachers-backup.json` 파일 내용:

```json
{
  "timestamp": "2026-01-16T10:30:45.123Z",
  "teachers": [
    {
      "firestoreId": "abc123",
      "id": "abc123",
      "name": "김민주",
      "subjects": ["수학"],
      "isHidden": false,
      "isNative": false,
      "bgColor": "#3b82f6",
      "textColor": "#ffffff",
      "order": 1,
      "defaultRoom": "3강의실"
    },
    {
      "firestoreId": "def456",
      "id": "def456",
      "name": "Ellen",
      "subjects": ["영어"],
      "isHidden": false,
      "isNative": true,
      "bgColor": "#ef4444",
      "textColor": "#ffffff",
      "order": 2,
      "defaultRoom": "1강의실"
    }
    // ... 총 22명
  ]
}
```

---

## 마이그레이션 후 Firestore 구조

### Before (강사목록 컬렉션)

```
강사목록/
  ├─ abc123/
  │   ├─ name: "김민주"
  │   ├─ subjects: ["수학"]
  │   ├─ isHidden: false
  │   ├─ isNative: false
  │   ├─ bgColor: "#3b82f6"
  │   ├─ textColor: "#ffffff"
  │   ├─ order: 1
  │   └─ defaultRoom: "3강의실"
  └─ def456/
      ├─ name: "Ellen"
      ├─ subjects: ["영어"]
      ├─ isHidden: false
      ├─ isNative: true
      ├─ bgColor: "#ef4444"
      ├─ textColor: "#ffffff"
      ├─ order: 2
      └─ defaultRoom: "1강의실"
```

### After (staff 컬렉션)

```
staff/
  ├─ abc123/  ← 동일한 ID 유지
  │   ├─ name: "김민주"
  │   ├─ email: ""
  │   ├─ phone: ""
  │   ├─ role: "teacher"
  │   ├─ subjects: ["math"]
  │   ├─ hireDate: "2026-01-16"
  │   ├─ status: "active"
  │   ├─ isHiddenInTimetable: false
  │   ├─ isNative: false
  │   ├─ bgColor: "#3b82f6"
  │   ├─ textColor: "#ffffff"
  │   ├─ timetableOrder: 1
  │   ├─ defaultRoom: "3강의실"
  │   ├─ createdAt: "2026-01-16T10:30:45.123Z"
  │   └─ updatedAt: "2026-01-16T10:30:45.123Z"
  └─ def456/
      ├─ name: "Ellen"
      ├─ email: ""
      ├─ phone: ""
      ├─ role: "teacher"
      ├─ subjects: ["english"]
      ├─ hireDate: "2026-01-16"
      ├─ status: "active"
      ├─ isHiddenInTimetable: false
      ├─ isNative: true
      ├─ bgColor: "#ef4444"
      ├─ textColor: "#ffffff"
      ├─ timetableOrder: 2
      ├─ defaultRoom: "1강의실"
      ├─ createdAt: "2026-01-16T10:30:45.123Z"
      └─ updatedAt: "2026-01-16T10:30:45.123Z"

강사목록/  ← 그대로 유지됨 (삭제하지 않음)
  ├─ abc123/
  └─ def456/
```

---

## 팁

1. **항상 Dry-run으로 먼저 확인**
   ```bash
   npm run migrate:teachers -- --dry-run
   ```

2. **백업 파일 안전하게 보관**
   - `backups/teachers-backup.json` 파일을 별도로 백업

3. **원본 컬렉션 보존**
   - `강사목록` 컬렉션은 자동으로 보존됨
   - 최소 30일 후에 삭제 고려

4. **Firebase Console에서 검증**
   - 마이그레이션 후 `staff` 컬렉션 확인
   - 모든 필드가 올바른지 확인

5. **애플리케이션 테스트**
   - 시간표, 수업 관리, 출석부 등에서 정상 작동 확인
