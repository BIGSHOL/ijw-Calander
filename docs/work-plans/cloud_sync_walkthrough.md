# Student Migration - Hierarchical Enrollments

## Summary

Successfully migrated student data from a flat structure (`teacherIds[]`, `subjects[]`) to a hierarchical `enrollments[]` structure that properly tracks Subject → Class → Teacher relationships.

## Changes Made

### 1. Type Definition ([types.ts](file:///f:/ijw-calander/types.ts))

**Added:**
```typescript
export interface Enrollment {
  subject: 'math' | 'english';
  classId: string;    // Document ID of the class
  className: string;  // Name of the class  
  teacherId: string;  // Teacher Name
}
```

**Modified `UnifiedStudent`:**
- Removed: `subjects[]`, `teacherIds[]` (redundant)
- Added: `enrollments: Enrollment[]`

---

### 2. Migration Script ([migrateStudents.ts](file:///f:/ijw-calander/scripts/migrateStudents.ts))

**Key Features:**
- **v5**: Properly handles English homeroom teacher logic
- Iterates through `english_schedules` document fields (structure: DocID = Teacher, Fields = schedule cells)
- Counts teacher appearances per class, selects homeroom by:
  1. Most frequent teacher
  2. Non-native preferred when tied

---

### 3. Data Normalization ([normalizeTeacherDataV2.ts](file:///f:/ijw-calander/scripts/normalizeTeacherDataV2.ts))

Fixed teacher name inconsistencies across collections:
- `강사목록`: Renamed documents (e.g., `민주` → `김민주`)
- `수업목록`: Renamed class IDs (e.g., `수학_민주_...` → `수학_김민주_...`)
- `english_schedules`: Updated document IDs and teacher fields

**Mappings Applied:**
| Old | New |
|-----|-----|
| 민주 | 김민주 |
| 성우 | 이성우 |
| 정은 | 김은정 |
| 희영 | 이희영 |
| 서영 | 윤서영 |
| 승아 | 이승아 |
| 윤하 | 김윤하 |

---

## Verification

**Example: 강민준 (침산초, 4학년)**

```
enrollments: [
  { subject: "math", className: "수요일 1교시", teacherId: "김민주" },
  { subject: "math", className: "초등M 초저 개별진도반", teacherId: "김윤하" },
  { subject: "english", className: "LE1", teacherId: "Hannah" }
]
```

✅ Multiple math classes with different teachers  
✅ English class with correct homeroom teacher  

---

## Phase 2 Update: Multi-Teacher & Real-Time Sync

### 1. English Multi-Teacher Enrollment
Changed enrollment logic for English classes to support team-teaching models.
- **Before:** One homeroom teacher per class.
- **After:** Separate enrollment entries for **each teacher** involved in the class.
- **Example (LT1b):**
  - Ellen: [Tue, Fri]
  - Kristine: [Thu]
  - Florence: [Fri]
- **Benefit:** Attendance sheets accurately reflect which teacher is responsible for which day.

### 2. Cloud Functions Sync
Implemented a real-time synchronization system between **Timetable** and **Attendance**.
- **Trigger:** Changes in `수업목록` (Timetable Classes) collection.
- **Action:** Automatically updates `students` collection.
  - **Add Student:** Creates new student record or adds enrollment.
  - **Remove Student:** Removes enrollment or marks student as withdrawn if no enrollments remain.
- **Region:** `asia-northeast3` (Seoul) for low latency.

### 3. UI Safety Updates
Restricted manual data entry to ensure TimeTable remains the single source of truth.
- **Removed:** "Add Student" button from Attendance Manager.
- **Removed:** "Delete Student" button from Student Modal.
- **Locked:** Group and Days fields in Student Modal (Read-only).

✅ **Result:** Automated data flow, reduced manual errors, and accurate multi-teacher tracking.
