# Event View Mode Implementation Plan

## 1. Objective
Currently, clicking an existing event immediately opens it in **Edit Mode**.
The goal is to change this behavior so that:
1.  Clicking an event opens it in **View Mode** (Read-Only) first.
2.  Users must explicitly click an **"수정" (Edit)** button to enter Edit Mode.
3.  New events will still open directly in Edit Mode.

**Current Status** (2025-12-30):
- ✅ **Implemented** - EventModal.tsx now supports View Mode feature
- 📅 **Completed**: 2025-12-30

## 2. Component Analysis: `EventModal.tsx`

### Current State
- `canEditCurrent`: Derived from permissions. Directly controls `disabled` state of inputs.
- `handleSubmit`: Handles saving.
- Footer: Shows "Delete", "Cancel", "Save".

### Proposed Changes

#### A. State Management
- Add new state: `const [isViewMode, setIsViewMode] = useState(false);`
- **Initialization** (in `useEffect`):
    - If `existingEvent` is present: `setIsViewMode(true)`
    - If `existingEvent` is null (New Event): `setIsViewMode(false)`

#### B. UI Logic (Conditionals)

1.  **Input Fields (`disabled` prop)**
    - Current: `disabled={!canEditCurrent}`
    - New: `disabled={isViewMode || !canEditCurrent}`
    - *Effect*: Inputs are locked in View Mode, even if user has edit permissions.

2.  **Header Title**
    - View Mode: "일정 상세" (Event Detail)
    - Edit Mode: "일정 수정" (Edit Event) / "새 일정 추가" (New Event)

3.  **Footer Actions**

    **Scenario 1: View Mode (`isViewMode === true`)**
    - **Left**: "삭제" (Delete) - *Only if `canDeleteEvent` is true*
    - **Right**:
        - "닫기" (Close) - Closes the modal.
        - "수정" (Edit) - *Only if `canSaveEvent` is true*.
            - Action: `setIsViewMode(false)`

    **Scenario 2: Edit Mode (`isViewMode === false`)**
    - **Left**: "삭제" (Delete) - *Only if `canDeleteEvent` is true*
    - **Right**:
        - "취소" (Cancel)
            - Action: Revert to View Mode (and reset form data) if it was an existing event.
            - Action: Close modal if it was a new event.
        - "저장" (Save) - Submits form.

## 3. Implementation Steps

1.  **Modify `EventModal.tsx`**:
    - Add `isViewMode` state.
    - Update `useEffect` to initialize `isViewMode`.
    - Update `disabled` logic for all inputs.
    - Update Header title logic.
    - Refactor Footer buttons to support the 2 modes.
    - Add logic to "Cancel" button to reset form data when reverting to View Mode.

2.  **Verification**:
    - Open existing event -> Check View Mode (inputs disabled, "Edit" button visible).
    - Click "Edit" -> Check Edit Mode (inputs enabled).
    - Click "Cancel" -> Revert to View Mode.
    - Create New Event -> Check Edit Mode (inputs enabled immediately).

---

## 4. Code Verification Results (2025-12-30)

### ✅ Implementation Status: **IMPLEMENTED**

**File**: `components/EventModal.tsx`

All View Mode features specified in this plan have been **implemented**.

### Detailed Findings

#### A. State Management ✅
**Expected**:
```tsx
const [isViewMode, setIsViewMode] = useState(false);
```

**Actual**: `isViewMode` state exists and is initialized correctly.


---

#### B. Input Fields `disabled` Logic ✅
**Expected**:
```tsx
disabled={isViewMode || !canEditCurrent}
```

**Actual**: Implemented as expected.
```tsx
disabled={isViewMode || !canEditCurrent}
```

**Affected Lines**:
- Line 298 (Title input)
- Line 634 (Description textarea)
- Line 660 (Reference URL input)
- Additional: Lines 324, 409, 423, 431, 449, 458, 582 (all inputs)

---

#### C. Header Title ✅
**Expected**:
- View Mode: "일정 상세" (Event Detail)
- Edit Mode (existing): "일정 수정" (Edit Event)
- Edit Mode (new): "새 일정 추가" (New Event)

**Actual**: Implemented as expected.
```tsx
{isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
```

---

#### D. Footer Buttons ✅

**Expected for View Mode**:
- Left: "삭제" (if `canDeleteEvent`)
- Right: "닫기" + "수정" (if `canSaveEvent`)

**Expected for Edit Mode**:
- Left: "삭제" (if `canDeleteEvent`)
- Right: "취소" + "저장"

**Actual**: Implemented as expected with mode switching logic.
- View Mode: "삭제" + "닫기" + "수정" (Lines 767-862)
- Edit Mode: "삭제" + "취소" + "저장" (Lines 767-872)

---

#### E. View Mode Initialization ✅
**Expected** (in `useEffect`):
```tsx
if (existingEvent) {
  setIsViewMode(true);  // Existing events open in View Mode
} else {
  setIsViewMode(false); // New events open in Edit Mode
}
```

**Actual**: Implemented in `useEffect` to set `isViewMode(true)` if `existingEvent` is present.

---

#### F. Cancel Button Behavior ✅
**Expected**:
- Editing existing event: Revert to View Mode and reset form data
- Creating new event: Close modal

**Actual**: Implemented to revert to View Mode and reset form data.
- Line 825: `setIsViewMode(true)` for existing events
- Lines 828-841: Form data reset logic
- Line 844: `onClose()` for new events

---

## 5. Implementation Checklist

### ✅ All Changes Completed (2025-12-30)

- [x] **Add `isViewMode` state** (Line 66) ✅
  ```tsx
  const [isViewMode, setIsViewMode] = useState(false);
  ```

- [x] **Update `useEffect` initialization** (Lines 105-144) ✅
  ```tsx
  // Existing events (Line 106)
  setIsViewMode(true);

  // New events (Line 144)
  setIsViewMode(false);
  ```

- [x] **Update input `disabled` logic** (Lines 298, 324, 409, 423, 431, 449, 458, 582, 634, 660) ✅
  ```tsx
  disabled={isViewMode || !canEditCurrent}
  ```

- [x] **Update header title** (Line 278) ✅
  ```tsx
  {isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
  ```

- [x] **Refactor footer buttons** (Lines 767-872) ✅
  - "수정" button for View Mode (Lines 854-862)
  - Mode-specific button rendering
  - `onClick={() => setIsViewMode(false)}` implemented (Line 857)

- [x] **Update Cancel button logic** (Lines 817-845) ✅
  ```tsx
  onClick={() => {
    if (existingEvent && !isViewMode) {
      setIsViewMode(true);  // Line 825
      // Reset form data (Lines 828-841)
    } else {
      onClose();  // Line 844
    }
  }}
  ```

---

## 6. Testing Verification Plan

### ✅ Code Verification Completed (2025-12-30)

All implementation requirements verified through code analysis:

1. **Existing Event → View Mode** ✅
   - [x] Opens in View Mode (Line 106: `setIsViewMode(true)`)
   - [x] All inputs disabled (Lines 298, 324, 409, 423, 431, 449, 458, 582, 634, 660)
   - [x] Header shows "일정 상세" (Line 278)
   - [x] Footer shows "닫기" + "수정" buttons (Lines 815-862)

2. **View Mode → Edit Mode** ✅
   - [x] "수정" button switches mode (Line 857: `onClick={() => setIsViewMode(false)}`)
   - [x] Inputs become enabled (disabled logic checks `isViewMode`)
   - [x] Header changes to "일정 수정" (Line 278)
   - [x] Footer shows "취소" + "저장" buttons (Lines 815-872)

3. **Edit Mode → View Mode (Cancel)** ✅
   - [x] "취소" button reverts to View Mode (Line 825: `setIsViewMode(true)`)
   - [x] Form data reset logic implemented (Lines 828-841)

4. **New Event → Edit Mode** ✅
   - [x] Opens in Edit Mode (Line 144: `setIsViewMode(false)`)
   - [x] Inputs enabled by default
   - [x] Header shows "새 일정 추가" (Line 278)

### User Acceptance Testing Required
- [ ] Manual UI testing recommended to verify user experience
- [ ] Test all input interactions in View/Edit modes
- [ ] Verify button click behaviors
- [ ] Test save flow for existing vs new events

---

## 7. Priority and Next Steps

**Priority**: ✅ Completed

**Actual Effort**: Completed on 2025-12-30

**Completion Status**:
1. ✅ Implemented `isViewMode` state and initialization logic (Lines 66, 106, 144)
2. ✅ Updated input disabled logic across all form fields (10+ inputs)
3. ✅ Refactored header and footer rendering (Lines 278, 767-872)
4. ✅ Code verification completed (100% implementation confirmed)
5. ✅ Document updated with verification results

**Remaining Work**:
- Manual UI/UX testing recommended for user acceptance
- No code changes required

---

## 8. Recent Refinements (2025-12-30)

### Bug Fixes & Improvements
1.  **Strict Read-Only Mode**:
    -   Applied `disabled` prop to Department checkboxes, Date/Time inputs, and Participant checkboxes in View Mode.
    -   Visual indication (opacity/cursor) added for disabled elements.

2.  **Reference URL Enhancements**:
    -   **View Mode**: Renders as a clickable button (`<a>` tag) that opens in a new tab.
    -   **Edit Mode**: Renders as a text input for editing.

3.  **Color Picker Locking**:
    -   Color inputs are now disabled in View Mode.
    -   Hover effects disabled to indicate read-only state.

4.  **Save Flow UX**:
    -   **Existing Events**: Clicking "Save" now keeps the modal open and switches back to **View Mode** to show the updated state.
    -   **New Events**: Clicking "Save" closes the modal (default behavior).
