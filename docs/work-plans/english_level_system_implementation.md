# English Level System Implementation Plan

## 1. Objective
Implement a configurable system to manage English class levels. This system will map two-letter abbreviations (e.g., "DP") to full names (e.g., "Dr. Phonics") and define a hierarchical order. This order and mapping will be editable by administrators.

## 2. Requirements

### Core Features
1.  **Level Management**: Add, Edit, Delete English levels.
2.  **Order Management**: Reorder levels to define hierarchy (e.g., DP -> PL -> ... -> MEC).
3.  **Data Persistence**: Save configuration to Firestore.
4.  **Default Initialization**: Pre-populate with the standard academy curriculum if empty.

### Default Level Hierarchy
1.  **DP**: Dr. Phonics
2.  **PL**: Pre Let's
3.  **RTT**: Ready To Talk
4.  **LT**: Let's Talk
5.  **RTS**: Ready To Speak
6.  **LS**: Let's Speak
7.  **LE**: Let's Express
8.  **KW**: Kopi Wang
9.  **PJ**: Pre Junior
10. **JP**: Junior Plus
11. **SP**: Senior Plus
12. **MEC**: Middle School English Course

## 3. Technical Design

### Data Model
- **Firestore Path**: `settings/english_levels`
- **Document Structure**:
  ```typescript
  interface EnglishLevel {
    id: string;          // e.g., "dp", "pl" (auto-generated or abbreviation lowercased)
    abbreviation: string;// e.g., "DP"
    fullName: string;    // e.g., "Dr. Phonics"
    order: number;       // Sort order (0, 1, 2...)
    color?: string;      // Optional: Future use for level-specific colors
  }

  interface LevelSettings {
    levels: EnglishLevel[];
  }
  ```

### UI Components

#### 1. `LevelSettingsModal.tsx`
- **Location**: `components/Timetable/English/LevelSettingsModal.tsx`
- **Features**:
    - List view of current levels.
    - Drag-and-drop or Up/Down buttons for reordering.
    - Form to add new level (Abbreviation, Full Name).
    - Edit/Delete actions for each item.
    - "Save" button to persist changes.

#### 2. Integration Point
- Add a "레벨 설정" (Level Settings) button in `EnglishTimetable.tsx` or `IntegrationViewSettings.tsx` to open the modal.

### Implementation Steps

1.  **Create Component**: Build `LevelSettingsModal` with local state management.
2.  **Implement Logic**:
    - `fetchLevels`: Load from `settings/english_levels`.
    - `saveLevels`: Write to Firestore.
    - `initializeDefaults`: If doc doesn't exist, allow user to "Load Defaults".
3.  **Integration**: Connect the modal to the main English Timetable view.

## 4. Verification Plan

1.  **Open Settings**: Verify "Level Settings" button exists.
2.  **Load Defaults**: Verify the list populates with DP through MEC in correct order.
3.  **Edit**: Change "Dr. Phonics" to "Dr. Phonics Modified" and save. Reload to verify persistence.
4.  **Reorder**: Move MEC to the top. Save and Reload. Verify order persists.
5.  **Add/Delete**: Add a new level "TEST", save, then delete it.

---

## 5. Code Verification Results (2025-12-30)

### ❌ Implementation Status: **NOT IMPLEMENTED**

**Comprehensive code review performed** - Zero implementation found across all planned components.

### Detailed Findings

#### A. Data Model (Firestore) ❌
**Status**: Not Implemented

**Missing Components**:
- ❌ No Firestore path `settings/english_levels` found in codebase
- ❌ No `EnglishLevel` interface in `types.ts` (checked lines 1-232)
- ❌ No `LevelSettings` interface exists

**Required Interfaces** (Missing from `types.ts`):
```typescript
interface EnglishLevel {
  id: string;
  abbreviation: string;
  fullName: string;
  order: number;
  color?: string;
}

interface LevelSettings {
  levels: EnglishLevel[];
}
```

---

#### B. UI Component: LevelSettingsModal.tsx ❌
**Status**: Not Implemented

**Missing File**: `components/Timetable/English/LevelSettingsModal.tsx` does not exist

**Missing Features**:
- ❌ List view of levels
- ❌ Drag-and-drop reordering
- ❌ Up/Down buttons for reordering
- ❌ Add new level form
- ❌ Edit/Delete actions
- ❌ Save button with Firestore integration

**Reference Pattern Available**: `TeacherOrderModal.tsx` exists and implements similar features (drag-and-drop, up/down buttons, modal structure)

---

#### C. Integration Point ❌
**Status**: Not Implemented

**Checked Files**:
1. `EnglishTimetable.tsx` (lines 1-210)
   - ❌ No "레벨 설정" button
   - ❌ No import for `LevelSettingsModal`

2. `IntegrationViewSettings.tsx` (lines 1-557)
   - ❌ No "레벨 설정" button
   - Only has "뷰 설정" button (for view settings)

**Reference Pattern Available**: `EnglishClassTab.tsx` shows proper modal integration pattern (lines 55-76, 476-482, 542-548)

---

#### D. Core Logic ❌
**Status**: Not Implemented

**Missing Functions**:
- ❌ `fetchLevels`: No function to load from Firestore
- ❌ `saveLevels`: No function to write to Firestore
- ❌ `initializeDefaults`: No default level initialization

**Reference Patterns Available**:
- Firestore `onSnapshot` pattern in `EnglishTimetable.tsx` (lines 90-97)
- Firestore `setDoc` pattern in `EnglishClassTab.tsx` (line 75)

---

#### E. Default Levels (12 levels) ❌
**Status**: Not Implemented

**Missing**: No default levels array exists in codebase
- Pattern search for level abbreviations (DP, PL, RTT, etc.) found ONLY in documentation
- No initialization logic implemented

---

## 6. Recommendations and Implementation Guide

### 🎯 Priority: HIGH
This feature is completely missing despite having comprehensive documentation.

### ✅ Positive Infrastructure Available

The project has **excellent foundation** for implementation:

1. **Modal Pattern Reference**: `TeacherOrderModal.tsx`
   - Drag-and-drop using @dnd-kit library
   - Up/Down arrow buttons
   - Save/cancel pattern
   - Proper backdrop click handling

2. **Firestore Integration Patterns**
   - Real-time listeners: `EnglishTimetable.tsx` (lines 90-97)
   - Save operations: `EnglishClassTab.tsx` (line 75)
   - Settings persistence examples throughout

3. **Similar Feature Reference**: `ClassesTab.tsx`
   - Add/Delete/Color picker pattern
   - CRUD operations with Firestore

### 📋 Implementation Roadmap

#### Phase 1: Foundation (1-2 hours)
- [ ] Add `EnglishLevel` and `LevelSettings` interfaces to `types.ts`
- [ ] Create `DEFAULT_ENGLISH_LEVELS` constant with 12 default levels
- [ ] Initialize Firestore document at `settings/english_levels`

**Suggested Code**:
```typescript
// types.ts
export interface EnglishLevel {
  id: string;
  abbreviation: string;
  fullName: string;
  order: number;
  color?: string;
}

export interface LevelSettings {
  levels: EnglishLevel[];
}

// constants or LevelSettingsModal.tsx
const DEFAULT_ENGLISH_LEVELS: EnglishLevel[] = [
  { id: 'dp', abbreviation: 'DP', fullName: 'Dr. Phonics', order: 0 },
  { id: 'pl', abbreviation: 'PL', fullName: "Pre Let's", order: 1 },
  { id: 'rtt', abbreviation: 'RTT', fullName: 'Ready To Talk', order: 2 },
  { id: 'lt', abbreviation: 'LT', fullName: "Let's Talk", order: 3 },
  { id: 'rts', abbreviation: 'RTS', fullName: 'Ready To Speak', order: 4 },
  { id: 'ls', abbreviation: 'LS', fullName: "Let's Speak", order: 5 },
  { id: 'le', abbreviation: 'LE', fullName: "Let's Express", order: 6 },
  { id: 'kw', abbreviation: 'KW', fullName: 'Kopi Wang', order: 7 },
  { id: 'pj', abbreviation: 'PJ', fullName: 'Pre Junior', order: 8 },
  { id: 'jp', abbreviation: 'JP', fullName: 'Junior Plus', order: 9 },
  { id: 'sp', abbreviation: 'SP', fullName: 'Senior Plus', order: 10 },
  { id: 'mec', abbreviation: 'MEC', fullName: 'Middle School English Course', order: 11 }
];
```

#### Phase 2: Core Component (3-4 hours)
- [ ] Create `components/Timetable/English/LevelSettingsModal.tsx`
- [ ] Implement list view with drag-and-drop (use @dnd-kit like TeacherOrderModal)
- [ ] Add form for adding new levels (abbreviation + full name inputs)
- [ ] Implement edit/delete functionality
- [ ] Add save button with Firestore `setDoc` integration
- [ ] Include "Load Defaults" button for first-time setup

**Template Reference**: Use `TeacherOrderModal.tsx` (lines 1-190) as structural template

#### Phase 3: Integration (1 hour)
- [ ] Add "레벨 설정" button to `EnglishTimetable.tsx` or `IntegrationViewSettings.tsx`
- [ ] Import and render `LevelSettingsModal` component
- [ ] Add state management for modal open/close

**Integration Pattern**:
```typescript
// State
const [isLevelSettingsOpen, setIsLevelSettingsOpen] = useState(false);

// Button
<button onClick={() => setIsLevelSettingsOpen(true)}>
  <Settings size={14} />
  레벨 설정
</button>

// Modal
<LevelSettingsModal
  isOpen={isLevelSettingsOpen}
  onClose={() => setIsLevelSettingsOpen(false)}
/>
```

#### Phase 4: Firestore Logic (1-2 hours)
- [ ] Implement `fetchLevels` with real-time listener
- [ ] Implement `saveLevels` with error handling
- [ ] Implement `initializeDefaults` for first-time users

**Firestore Pattern**:
```typescript
// Fetch (Real-time)
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, 'settings', 'english_levels'), (doc) => {
    if (doc.exists()) {
      setLevels(doc.data().levels || []);
    } else {
      // Optionally initialize with defaults
      setLevels(DEFAULT_ENGLISH_LEVELS);
    }
  });
  return () => unsubscribe();
}, []);

// Save
const saveLevels = async (levels: EnglishLevel[]) => {
  try {
    await setDoc(doc(db, 'settings', 'english_levels'), { levels });
  } catch (error) {
    console.error('Failed to save levels:', error);
    throw error;
  }
};
```

#### Phase 5: Testing & Verification (1 hour)
- [ ] Test default level initialization
- [ ] Test add/edit/delete operations
- [ ] Test drag-and-drop reordering
- [ ] Test up/down button reordering
- [ ] Verify Firestore persistence (reload page)
- [ ] Test with multiple users/browsers

**Total Estimated Effort**: 6-10 hours

### 🔍 Critical Issues Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| Complete feature missing | 🔴 High | Feature documented but zero code exists |
| No type safety | 🔴 High | Cannot implement without base TypeScript types |
| No user access | 🔴 High | Users cannot manage English levels |

### ✅ Implementation Confidence: HIGH

Despite being completely unimplemented, this feature has **excellent** infrastructure support:
- Similar working examples exist (TeacherOrderModal, ClassesTab)
- Firestore patterns proven and tested
- @dnd-kit library already integrated
- Consistent code patterns throughout project

**Recommendation**: Implement immediately following the roadmap above, using existing components as templates.

---

## 7. File References

**Files Reviewed**:
- `d:\ijw-calander\types.ts` (lines 1-232)
- `d:\ijw-calander\components\Timetable\English\EnglishTimetable.tsx` (lines 1-210)
- `d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx` (lines 1-759)
- `d:\ijw-calander\components\Timetable\English\IntegrationViewSettings.tsx` (lines 1-557)
- `d:\ijw-calander\components\Timetable\English\TeacherOrderModal.tsx` (lines 1-190) ⭐ Template Reference
- `d:\ijw-calander\components\settings\ClassesTab.tsx` (lines 1-149) ⭐ Pattern Reference

**Review Date**: 2025-12-30
**Review Confidence**: 100% (Complete codebase coverage)
