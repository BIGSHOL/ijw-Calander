# English Level System Implementation Plan

## 현재 상태 (Implementation Status)

**Implementation Progress**: 0% COMPLETE (NOT STARTED)
**Last Updated**: 2025-12-31
**Estimated Total Time**: 6-10 hours

### Quick Status Overview
- [ ] 0% - Data model types defined
- [ ] 0% - Firestore document structure created
- [ ] 0% - LevelSettingsModal component built
- [ ] 0% - Integration point added
- [ ] 0% - Default levels initialized
- [ ] 0% - Testing completed

### Infrastructure Available (Ready to Use)
- ✅ @dnd-kit library integrated (for drag-and-drop)
- ✅ Firestore patterns established
- ✅ Reference components exist (TeacherOrderModal, ClassesTab)
- ✅ Modal patterns implemented throughout project

---

## 즉시 시작 가능한 Phase 1 (Start Here)

**Goal**: Create foundation in 1-2 hours
**Prerequisites**: None - Start immediately

### Task 1.1: Add TypeScript Interfaces (10 minutes)
**File**: `d:\ijw-calander\types.ts`
**Action**: Add at the end of the file

```typescript
// English Level System
export interface EnglishLevel {
  id: string;          // e.g., "dp", "pl" (lowercase abbreviation)
  abbreviation: string;// e.g., "DP", "PL" (display version)
  fullName: string;    // e.g., "Dr. Phonics"
  order: number;       // Sort order (0, 1, 2...)
  color?: string;      // Optional: Future use for level-specific colors
}

export interface LevelSettings {
  levels: EnglishLevel[];
}
```

**Verification**: TypeScript compiles without errors

---

### Task 1.2: Create Default Levels Constant (15 minutes)
**File**: `d:\ijw-calander\components\Timetable\English\LevelSettingsModal.tsx` (new file)
**Action**: Create file with this starter code

```typescript
import React from 'react';
import { EnglishLevel, LevelSettings } from '../../../types';

// Default English levels for IJW Academy
export const DEFAULT_ENGLISH_LEVELS: EnglishLevel[] = [
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

interface LevelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LevelSettingsModal({ isOpen, onClose }: LevelSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4">영어 레벨 설정</h2>
        <p className="text-gray-600">Component skeleton created - Phase 2 will add functionality</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

**Verification**: File imports without errors

---

### Task 1.3: Add Integration Point (20 minutes)
**File**: `d:\ijw-calander\components\Timetable\English\EnglishTimetable.tsx`
**Action**: Add these code segments

**Step A**: Add import at top
```typescript
import LevelSettingsModal from './LevelSettingsModal';
import { Settings } from 'lucide-react';
```

**Step B**: Add state (around line 30, with other useState)
```typescript
const [isLevelSettingsOpen, setIsLevelSettingsOpen] = useState(false);
```

**Step C**: Add button in header (find the header section, add near other buttons)
```typescript
<button
  onClick={() => setIsLevelSettingsOpen(true)}
  className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 flex items-center gap-1"
>
  <Settings size={14} />
  레벨 설정
</button>
```

**Step D**: Add modal before closing component (before final closing tag)
```typescript
<LevelSettingsModal
  isOpen={isLevelSettingsOpen}
  onClose={() => setIsLevelSettingsOpen(false)}
/>
```

**Verification**:
- Button appears in EnglishTimetable UI
- Clicking button opens modal
- Modal shows skeleton content
- Closing modal works

---

### Task 1.4: Initialize Firestore Document (15 minutes)
**Option A - Manual (via Firebase Console)**:
1. Open Firebase Console
2. Navigate to Firestore Database
3. Create document: `settings/english_levels`
4. Add field: `levels` (type: array)
5. Populate with 12 default levels

**Option B - Code (Recommended)**:
Add this temporary initialization function to LevelSettingsModal:

```typescript
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// Add this function inside component
const initializeDefaults = async () => {
  try {
    await setDoc(doc(db, 'settings', 'english_levels'), {
      levels: DEFAULT_ENGLISH_LEVELS
    });
    alert('Default levels initialized!');
  } catch (error) {
    console.error('Failed to initialize:', error);
    alert('Initialization failed');
  }
};

// Add button in modal
<button
  onClick={initializeDefaults}
  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
>
  Initialize Default Levels
</button>
```

**Verification**:
- Firebase console shows `settings/english_levels` document
- Document contains array of 12 levels
- Each level has id, abbreviation, fullName, order fields

---

### Task 1.5: Test Phase 1 Completion (10 minutes)

**Checklist**:
- [ ] Types compile without errors
- [ ] LevelSettingsModal file exists and imports successfully
- [ ] "레벨 설정" button visible in EnglishTimetable
- [ ] Modal opens and closes correctly
- [ ] Firestore document `settings/english_levels` exists
- [ ] Document contains 12 default levels

**If all checked**: Phase 1 COMPLETE - Proceed to Phase 2

---

## 필수 파일 목록 (Required Files)

### Files to CREATE
1. **`components/Timetable/English/LevelSettingsModal.tsx`** (NEW)
   - Main component for level management
   - Template: Use `TeacherOrderModal.tsx` as reference
   - Size: ~300-400 lines (estimated)

### Files to MODIFY
1. **`types.ts`**
   - Add: `EnglishLevel` interface
   - Add: `LevelSettings` interface
   - Location: End of file (after existing types)

2. **`components/Timetable/English/EnglishTimetable.tsx`**
   - Add: Import LevelSettingsModal
   - Add: State for modal open/close
   - Add: "레벨 설정" button
   - Add: Modal component render
   - Lines affected: ~10-15 new lines

### Files to REFERENCE (Don't modify, use as templates)
1. **`components/Timetable/English/TeacherOrderModal.tsx`**
   - Reference for: Drag-and-drop implementation
   - Reference for: Modal structure
   - Reference for: Up/down buttons

2. **`components/settings/ClassesTab.tsx`**
   - Reference for: Add/Edit/Delete pattern
   - Reference for: Color picker (if implementing color field)
   - Reference for: CRUD operations

3. **`components/Timetable/English/EnglishClassTab.tsx`**
   - Reference for: Firestore setDoc pattern (line 75)

### Firestore Structure
**Path**: `settings/english_levels`
**Structure**:
```json
{
  "levels": [
    {
      "id": "dp",
      "abbreviation": "DP",
      "fullName": "Dr. Phonics",
      "order": 0
    },
    // ... 11 more levels
  ]
}
```

---

## Phase 2: Build Full Component (3-4 hours)

**Start after Phase 1 verification complete**

### Task 2.1: Add Drag-and-Drop (1 hour)
**Reference**: `TeacherOrderModal.tsx` lines 1-190

**Required Imports**:
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
```

**Component Structure**:
1. Wrap list in `<DndContext>`
2. Wrap items in `<SortableContext>`
3. Create `SortableLevelItem` sub-component
4. Handle `onDragEnd` event

**Verification Checklist**:
- [ ] Can drag items with mouse
- [ ] Items reorder visually
- [ ] Order numbers update correctly
- [ ] Keyboard navigation works

---

### Task 2.2: Add Up/Down Buttons (30 minutes)
**Reference**: `TeacherOrderModal.tsx` lines 85-100

**Code Pattern**:
```typescript
const moveUp = (index: number) => {
  if (index === 0) return;
  const newLevels = [...levels];
  [newLevels[index], newLevels[index - 1]] = [newLevels[index - 1], newLevels[index]];
  // Update order numbers
  newLevels.forEach((level, i) => level.order = i);
  setLevels(newLevels);
};

const moveDown = (index: number) => {
  if (index === levels.length - 1) return;
  const newLevels = [...levels];
  [newLevels[index], newLevels[index + 1]] = [newLevels[index + 1], newLevels[index]];
  newLevels.forEach((level, i) => level.order = i);
  setLevels(newLevels);
};
```

**Verification Checklist**:
- [ ] Up arrow moves item up (disabled at top)
- [ ] Down arrow moves item down (disabled at bottom)
- [ ] Order numbers update
- [ ] Visual feedback on hover

---

### Task 2.3: Add New Level Form (45 minutes)

**UI Elements**:
```typescript
const [newAbbr, setNewAbbr] = useState('');
const [newFullName, setNewFullName] = useState('');

const addLevel = () => {
  if (!newAbbr.trim() || !newFullName.trim()) {
    alert('Please fill in both fields');
    return;
  }

  const newLevel: EnglishLevel = {
    id: newAbbr.toLowerCase(),
    abbreviation: newAbbr.toUpperCase(),
    fullName: newFullName,
    order: levels.length
  };

  setLevels([...levels, newLevel]);
  setNewAbbr('');
  setNewFullName('');
};
```

**Form HTML**:
```typescript
<div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded">
  <input
    type="text"
    placeholder="Abbr (e.g., DP)"
    value={newAbbr}
    onChange={(e) => setNewAbbr(e.target.value)}
    className="flex-1 px-3 py-2 border rounded"
    maxLength={5}
  />
  <input
    type="text"
    placeholder="Full Name"
    value={newFullName}
    onChange={(e) => setNewFullName(e.target.value)}
    className="flex-2 px-3 py-2 border rounded"
  />
  <button
    onClick={addLevel}
    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
  >
    Add
  </button>
</div>
```

**Verification Checklist**:
- [ ] Form appears above level list
- [ ] Can type in both inputs
- [ ] Add button creates new level at bottom
- [ ] Fields clear after adding
- [ ] Validation prevents empty entries

---

### Task 2.4: Add Edit/Delete Functionality (45 minutes)

**Edit Pattern**:
```typescript
const [editingId, setEditingId] = useState<string | null>(null);

const startEdit = (level: EnglishLevel) => {
  setEditingId(level.id);
};

const saveEdit = (id: string, newAbbr: string, newFullName: string) => {
  setLevels(levels.map(level =>
    level.id === id
      ? { ...level, abbreviation: newAbbr, fullName: newFullName }
      : level
  ));
  setEditingId(null);
};

const cancelEdit = () => {
  setEditingId(null);
};
```

**Delete Pattern**:
```typescript
const deleteLevel = (id: string) => {
  if (!confirm('Are you sure you want to delete this level?')) return;

  const newLevels = levels
    .filter(level => level.id !== id)
    .map((level, index) => ({ ...level, order: index }));

  setLevels(newLevels);
};
```

**Verification Checklist**:
- [ ] Edit button shows inline inputs
- [ ] Can modify abbreviation and full name
- [ ] Save updates the level
- [ ] Cancel discards changes
- [ ] Delete shows confirmation
- [ ] Delete removes level and reorders

---

### Task 2.5: Add Firestore Integration (45 minutes)

**Load Levels (Real-time)**:
```typescript
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'settings', 'english_levels'),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as LevelSettings;
        setLevels(data.levels || []);
      } else {
        // Document doesn't exist yet
        setLevels([]);
      }
    },
    (error) => {
      console.error('Failed to load levels:', error);
    }
  );

  return () => unsubscribe();
}, []);
```

**Save Levels**:
```typescript
const [isSaving, setIsSaving] = useState(false);

const saveLevels = async () => {
  setIsSaving(true);
  try {
    await setDoc(doc(db, 'settings', 'english_levels'), {
      levels: levels
    });
    alert('Levels saved successfully!');
    onClose();
  } catch (error) {
    console.error('Failed to save levels:', error);
    alert('Failed to save levels. Please try again.');
  } finally {
    setIsSaving(false);
  }
};
```

**Save Button**:
```typescript
<div className="flex gap-2 justify-end mt-4">
  <button
    onClick={onClose}
    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
  >
    Cancel
  </button>
  <button
    onClick={saveLevels}
    disabled={isSaving}
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
  >
    {isSaving ? 'Saving...' : 'Save'}
  </button>
</div>
```

**Verification Checklist**:
- [ ] Levels load from Firestore on open
- [ ] Changes don't affect Firestore until Save clicked
- [ ] Save button disabled while saving
- [ ] Success message shows after save
- [ ] Modal closes after successful save
- [ ] Refresh page shows saved changes

---

## Phase 3: Testing & Refinement (1 hour)

### Task 3.1: Functional Testing (30 minutes)

**Test Scenario 1: Default Initialization**
- [ ] Fresh database: Click "Initialize Default Levels"
- [ ] Verify all 12 levels appear
- [ ] Verify correct order (DP first, MEC last)
- [ ] Verify abbreviations and full names match spec

**Test Scenario 2: Reordering**
- [ ] Drag MEC to top position
- [ ] Verify visual reorder
- [ ] Click Save
- [ ] Reload page
- [ ] Verify MEC still at top

**Test Scenario 3: Editing**
- [ ] Click edit on "Dr. Phonics"
- [ ] Change to "Dr. Phonics Modified"
- [ ] Click save (inline)
- [ ] Click Save (modal)
- [ ] Reload page
- [ ] Verify change persisted

**Test Scenario 4: Adding**
- [ ] Add new level: "TEST" / "Test Level"
- [ ] Verify appears at bottom
- [ ] Click Save
- [ ] Reload page
- [ ] Verify TEST level exists

**Test Scenario 5: Deleting**
- [ ] Delete "TEST" level
- [ ] Confirm deletion
- [ ] Verify removed from list
- [ ] Click Save
- [ ] Reload page
- [ ] Verify TEST level gone

**Test Scenario 6: Cancel Behavior**
- [ ] Make several changes (add, edit, reorder)
- [ ] Click Cancel instead of Save
- [ ] Reload page
- [ ] Verify no changes were saved

---

### Task 3.2: Edge Case Testing (15 minutes)

**Edge Case 1: Duplicate Abbreviations**
- [ ] Try adding level with existing abbreviation
- [ ] Should show warning or prevent duplicate

**Edge Case 2: Empty Fields**
- [ ] Try adding level with blank abbreviation
- [ ] Try adding level with blank full name
- [ ] Both should show validation error

**Edge Case 3: Special Characters**
- [ ] Try adding level with special chars (!@#$)
- [ ] Verify handling (allow or sanitize)

**Edge Case 4: Long Names**
- [ ] Try full name with 100+ characters
- [ ] Verify UI doesn't break

**Edge Case 5: Network Failure**
- [ ] Disconnect internet
- [ ] Try to save
- [ ] Should show error message
- [ ] Reconnect and verify can save

---

### Task 3.3: UI/UX Polish (15 minutes)

**Visual Checks**:
- [ ] Modal centers on screen
- [ ] Scrollable if many levels (10+)
- [ ] Buttons have hover states
- [ ] Loading states show clearly
- [ ] Error messages are user-friendly

**Accessibility**:
- [ ] Can tab through form fields
- [ ] Enter key submits add form
- [ ] Escape key closes modal
- [ ] Focus returns to button after close

**Responsive Design**:
- [ ] Test on mobile viewport (320px width)
- [ ] Test on tablet (768px width)
- [ ] Drag-and-drop works on touch devices

---

## 검증 체크리스트 (Verification Checklist)

### Phase 1 Verification
- [ ] **Types Added**: EnglishLevel and LevelSettings exist in types.ts
- [ ] **Default Levels**: DEFAULT_ENGLISH_LEVELS constant defined with 12 levels
- [ ] **Component Created**: LevelSettingsModal.tsx file exists
- [ ] **Integration**: Button appears in EnglishTimetable
- [ ] **Modal Works**: Opens and closes correctly
- [ ] **Firestore Doc**: settings/english_levels document exists

### Phase 2 Verification
- [ ] **Drag-and-Drop**: Can reorder levels by dragging
- [ ] **Up/Down Buttons**: Arrow buttons move items
- [ ] **Add Level**: Form adds new levels correctly
- [ ] **Edit Level**: Can modify abbreviation and full name
- [ ] **Delete Level**: Can remove levels with confirmation
- [ ] **Save Functionality**: Changes persist to Firestore
- [ ] **Load Functionality**: Levels load on modal open

### Phase 3 Verification
- [ ] **All Test Scenarios Pass**: 6/6 functional tests complete
- [ ] **Edge Cases Handled**: 5/5 edge cases tested
- [ ] **UI Polish Complete**: Visual, accessibility, responsive checks pass
- [ ] **No Console Errors**: Browser console clean
- [ ] **Performance**: Modal opens instantly (<100ms)

### Final Deployment Checklist
- [ ] Code reviewed by team member
- [ ] TypeScript compiles with no errors
- [ ] No new linting warnings
- [ ] Git commit with clear message
- [ ] Merged to main branch
- [ ] Production deployment successful
- [ ] Smoke test in production environment

---

## 1. Objective (Original Specification)

Implement a configurable system to manage English class levels. This system will map two-letter abbreviations (e.g., "DP") to full names (e.g., "Dr. Phonics") and define a hierarchical order. This order and mapping will be editable by administrators.

---

## 2. Requirements (Detailed Specification)

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

---

## 3. Technical Design (Detailed Specification)

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

---

## 4. Reference Components (Use as Templates)

### Primary Reference: TeacherOrderModal.tsx
**File**: `d:\ijw-calander\components\Timetable\English\TeacherOrderModal.tsx`

**What to Copy**:
1. **Drag-and-drop structure** (lines 1-190)
   - DndContext setup
   - SortableContext implementation
   - useSortable hook usage
   - onDragEnd handler

2. **Up/Down button logic** (lines 85-100)
   - moveUp function
   - moveDown function
   - Disabled state handling

3. **Modal structure**
   - Backdrop click handling
   - Centered layout
   - Close button placement

**Code Example to Reference**:
```typescript
// From TeacherOrderModal.tsx
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

function handleDragEnd(event: any) {
  const { active, over } = event;
  if (active.id !== over.id) {
    setItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }
}
```

### Secondary Reference: ClassesTab.tsx
**File**: `d:\ijw-calander\components\settings\ClassesTab.tsx`

**What to Copy**:
1. **Add/Edit/Delete pattern** (lines 1-149)
   - Form input handling
   - Validation logic
   - CRUD operations

2. **Color picker** (if implementing color field)
   - Color input type
   - Color preview display

### Firestore Reference: EnglishClassTab.tsx
**File**: `d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx`

**What to Copy**:
1. **setDoc pattern** (line 75)
   ```typescript
   await setDoc(doc(db, 'settings', 'english_levels'), { levels });
   ```

2. **onSnapshot pattern** (EnglishTimetable.tsx lines 90-97)
   ```typescript
   const unsubscribe = onSnapshot(doc(db, 'settings', 'english_levels'), (doc) => {
     if (doc.exists()) {
       setLevels(doc.data().levels || []);
     }
   });
   ```

---

## 5. Implementation Time Estimates

### Phase 1: Foundation (1-2 hours)
- Task 1.1: Add interfaces (10 min)
- Task 1.2: Create component file (15 min)
- Task 1.3: Add integration point (20 min)
- Task 1.4: Initialize Firestore (15 min)
- Task 1.5: Test Phase 1 (10 min)
- **Buffer time**: 30 min

### Phase 2: Core Component (3-4 hours)
- Task 2.1: Drag-and-drop (60 min)
- Task 2.2: Up/Down buttons (30 min)
- Task 2.3: Add level form (45 min)
- Task 2.4: Edit/Delete (45 min)
- Task 2.5: Firestore integration (45 min)
- **Buffer time**: 45 min

### Phase 3: Testing (1 hour)
- Task 3.1: Functional testing (30 min)
- Task 3.2: Edge cases (15 min)
- Task 3.3: UI polish (15 min)

### Total: 6-10 hours
- **Minimum** (experienced dev, no issues): 6 hours
- **Expected** (normal development pace): 7-8 hours
- **Maximum** (with debugging/refinement): 10 hours

---

## 6. Troubleshooting Guide

### Common Issues

**Issue 1: "Cannot find module '@dnd-kit/core'"**
- **Solution**: Run `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- **Note**: Library should already be installed (used in TeacherOrderModal)

**Issue 2: Firestore permission denied**
- **Solution**: Check Firestore rules allow write to `settings/english_levels`
- **Rules should include**:
  ```javascript
  match /settings/{document=**} {
    allow read, write: if request.auth != null;
  }
  ```

**Issue 3: Modal doesn't open**
- **Check**: State variable `isLevelSettingsOpen` defined
- **Check**: Button onClick sets state to true
- **Check**: Component receives isOpen prop
- **Debug**: Add `console.log('Modal isOpen:', isOpen)` at top of component

**Issue 4: Drag-and-drop not working**
- **Check**: @dnd-kit installed
- **Check**: DndContext wraps SortableContext
- **Check**: Items have unique `id` property
- **Debug**: Add `console.log('Drag end:', event)` in handleDragEnd

**Issue 5: Changes don't persist after reload**
- **Check**: Save button calls saveLevels function
- **Check**: saveLevels uses setDoc with correct path
- **Check**: Firebase console shows updated document
- **Debug**: Add console.log before and after setDoc call

**Issue 6: TypeScript errors**
- **Check**: Types imported from correct file path
- **Check**: Interface names match exactly (case-sensitive)
- **Solution**: Run `npm run build` to see all type errors

---

## 7. Future Enhancements (Post-MVP)

### Priority 2 Features (After basic implementation works)
1. **Color picker for levels**
   - Add color field to UI
   - Use in timetable to highlight levels visually

2. **Level usage statistics**
   - Show how many students/classes use each level
   - Prevent deletion of levels in use

3. **Import/Export**
   - Export level configuration as JSON
   - Import from another academy

4. **Level prerequisites**
   - Define which levels must come before others
   - Show progression path

### Priority 3 Features (Nice to have)
1. **Bulk reorder**
   - Reset to default order button
   - Alphabetical sort option

2. **Level descriptions**
   - Add description field for each level
   - Show in tooltips or expanded view

3. **Multi-language support**
   - Store level names in multiple languages
   - Switch between Korean/English labels

4. **Audit log**
   - Track who changed what and when
   - Rollback capability

---

## 8. Code Review Checklist (Before Merge)

### Code Quality
- [ ] No hardcoded strings (use constants)
- [ ] Error handling in all async functions
- [ ] TypeScript strict mode passes
- [ ] No any types (use proper interfaces)
- [ ] Functions are <50 lines (split if needed)

### Testing
- [ ] All Phase 3 tests passed
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested on mobile device
- [ ] No console errors or warnings

### Documentation
- [ ] Comments on complex logic
- [ ] JSDoc on public functions
- [ ] README updated if needed

### Performance
- [ ] No unnecessary re-renders
- [ ] Firestore listeners cleaned up
- [ ] Large lists use virtualization (if >50 items)

### Security
- [ ] Input validation on all fields
- [ ] XSS prevention (no dangerouslySetInnerHTML)
- [ ] Firestore rules verified

---

## 9. Success Metrics

### Feature Complete When:
1. Administrator can open "레벨 설정" modal from EnglishTimetable
2. Modal loads 12 default levels from Firestore
3. Administrator can drag-and-drop to reorder levels
4. Administrator can use up/down arrows to reorder
5. Administrator can add new levels with abbreviation and full name
6. Administrator can edit existing level names
7. Administrator can delete levels (with confirmation)
8. All changes persist to Firestore after clicking Save
9. Changes appear immediately after reload
10. No console errors during normal operation

### Quality Complete When:
1. All Phase 1, 2, 3 verification checklists pass
2. Code review checklist completed
3. Deployed to production without issues
4. Original author (from docs) approves feature

---

## 10. Contact & Support

### Need Help?
1. **Check existing components**: TeacherOrderModal, ClassesTab for patterns
2. **Firebase docs**: https://firebase.google.com/docs/firestore
3. **@dnd-kit docs**: https://docs.dndkit.com/

### Found a Bug?
1. Check console for errors
2. Check Firestore rules
3. Verify all dependencies installed
4. Review troubleshooting guide above

---

## Document Metadata

**Created**: 2025-12-30 (original)
**Reorganized**: 2025-12-31
**Status**: Implementation Ready
**Next Review**: After Phase 1 completion
**Owner**: Development Team
