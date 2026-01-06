# Unified Student DB Implementation Plan

Based on [unified_student_db_plan.md](file:///f:/ijw-calander/docs/work-plans/unified_student_db_plan.md).

## User Review Required

> [!IMPORTANT]
> This plan initiates a major data structure change.
> Phase 1 (Foundation) and Phase 2 (Migration) will be executed first.
> Backups will be created during migration.

## Proposed Changes

### Foundation Layer

#### [MODIFY] [types.ts](file:///f:/ijw-calander/types.ts)
- Add `UnifiedStudent` interface.
- Update `TimetableClass` to include optional `studentIds?: string[]`.

#### [MODIFY] [firestore.rules](file:///f:/ijw-calander/firestore.rules)
- Add security rules for `students` collection.

#### [NEW] [useStudents.ts](file:///f:/ijw-calander/hooks/useStudents.ts)
- Implement CRUD operations for `students` collection.

### Migration Tools

#### [NEW] [migrateStudents.ts](file:///f:/ijw-calander/scripts/migrateStudents.ts)
- Script to extract students from `수업목록` and populate `students`.
- Duplicate detection logic (Name + School + Grade).

### Phase 3: Timetable Modification Impact

> [!NOTE]
> **Architectural Shift**: From "Embedded Data" to "Reference Data".
>
> **Before**:
> - Class document contains full student data (`{ name: "Kim", grade: "4" ... }`).
> - Editing "Kim" in Math class DOES NOT update "Kim" in English class.
>
> **After**:
> - Class document contains only IDs (`studentIds: ["Kim_School_4"]`).
> - Component fetches actual data from `students` collection.
> - Editing "Kim" updates everywhere instantly.

1.  **[NEW] Link Students to Classes**: Create and run `scripts/linkStudentsToClasses.ts` to populate `studentIds` in `TimetableClass` documents based on existing `studentList`.
2.  **Refactor Components**:
    *   Update `studentIds` usage in `ClassCard` (Math/English).
    *   Update `TimetableBoard` to fetch referenced students.
3.  **Refactor Actions**:
    *   Update Drag & Drop logic (`useStudentDragDrop`).
    *   Update Add/Edit Student modals.
53: 
54: ### Phase 4: Attendance Refactoring
55: 
56: > [!WARNING]
57: > **Data Source Switch**: Changing source from `attendance_students` to `students` (Unified DB).
58: > Old attendance records linked to `attendance_students` IDs will not match new Unified UUIDs unless migrated.
59: > (Assuming fresh start or manual ID mapping for now, based on scope).
60: 
61: 1.  **[MODIFY] [types.ts](file:///f:/ijw-calander/components/Attendance/types.ts)**:
62:     - Align `Student` interface with `UnifiedStudent`.
63: 2.  **[MODIFY] [useAttendance.ts](file:///f:/ijw-calander/hooks/useAttendance.ts)**:
64:     - Change `STUDENTS_COLLECTION` to `'students'`.
65:     - Update `useAttendanceStudents` to fetch from Unified DB.
66:     - Update `useAddStudent` / `useDeleteStudent` to interact with Unified DB.
67:     - Maintain `attendance_records` logic (joined by ID).

#### UI/UX Changes
1.  **Reading**: Minimal change visually. Internally, components subscribes to `useStudents`.
2.  **Adding Students**:
    - **Current**: Type name/school/grade directly into the class slot.
    - **New**: "Select Student" modal or autocomplete search. (Or "Create New" which adds to global DB first).
3.  **Moving Students**:
    - **Current**: Copies data object to new class.
    - **New**: Moves ID string to new class.

### Phase 6: Cloud Function Enhancement (Metadata Sync)

#### [MODIFY] [index.js](file:///f:/ijw-calander/functions/index.js)

**Changes:**
- Logic Update: Detect changes in Class Metadata (Teacher, Days).
- Logic Update: If metadata changed, iterate through *all* `studentList` (not just added/removed) and update their enrollment details.

## Verification Plan

### Automated Verification
- Run `migrateStudents.ts` in dry-run mode (if possible) or check logs.
- Verify `students` collection population via Firestore console or script.

### Manual Verification
- **Test Case:** Rename a teacher in `TeachersTab`.
- **Expected Result:**
    1. `수업목록` updates (Client-side batch).
    2. Cloud Function triggers.
    3. `students` collection enrollments update to reflect new teacher name.
- After migration, check if simulated table views can access student data (once components are updated).
- For Phase 1, we primarily verify that the code compiles and the new hook is usable.

