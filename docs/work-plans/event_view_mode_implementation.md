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
- Line 286 (Title input)
- Line 615 (Description textarea)
- Line 630 (Reference URL input)

**Issue**: Inputs are only controlled by permissions, not by View/Edit mode state.

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

**Issue**: Always shows "일정 수정" for existing events, no distinction for View Mode.

---

#### D. Footer Buttons ✅

**Expected for View Mode**:
- Left: "삭제" (if `canDeleteEvent`)
- Right: "닫기" + "수정" (if `canSaveEvent`)

**Expected for Edit Mode**:
- Left: "삭제" (if `canDeleteEvent`)
- Right: "취소" + "저장"

**Actual**: Implemented as expected with mode switching logic.



**Missing**:
1. "수정" button to enter Edit Mode
2. Mode-aware button rendering
3. Conditional "취소" vs "닫기" logic

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




**Issue**: No revert-to-View-Mode logic implemented.

---

## 5. Implementation Checklist

### Required Changes

- [ ] **Add `isViewMode` state** (~line 50-72)
  ```tsx
  const [isViewMode, setIsViewMode] = useState(false);
  ```

- [ ] **Update `useEffect` initialization** (lines 94-196)
  ```tsx
  useEffect(() => {
    if (existingEvent) {
      setIsViewMode(true);
      // ... existing initialization
    } else {
      setIsViewMode(false);
    }
  }, [existingEvent, ...]);
  ```

- [ ] **Update input `disabled` logic** (lines 286, 615, 630, etc.)
  ```tsx
  disabled={isViewMode || !canEditCurrent}
  ```

- [ ] **Update header title** (lines 264-266)
  ```tsx
  {isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
  ```

- [ ] **Refactor footer buttons** (lines 732-796)
  - Add "수정" button for View Mode
  - Implement mode-specific button rendering
  - Add `onClick={() => setIsViewMode(false)}` to "수정" button

- [ ] **Update Cancel button logic** (lines 780-786)
  ```tsx
  onClick={() => {
    if (existingEvent && !isViewMode) {
      // Revert to View Mode and reset form
      setIsViewMode(true);
      // Reset form data to original values
    } else {
      onClose();
    }
  }}
  ```

---

## 6. Testing Verification Plan

After implementation, verify:

1. **Existing Event → View Mode**
   - [ ] Open existing event
   - [ ] Confirm all inputs are disabled
   - [ ] Confirm header shows "일정 상세"
   - [ ] Confirm footer shows "닫기" + "수정" buttons

2. **View Mode → Edit Mode**
   - [ ] Click "수정" button
   - [ ] Confirm inputs become enabled
   - [ ] Confirm header changes to "일정 수정"
   - [ ] Confirm footer shows "취소" + "저장" buttons

3. **Edit Mode → View Mode (Cancel)**
   - [ ] Click "취소" button
   - [ ] Confirm return to View Mode
   - [ ] Confirm form data is reset to original values

4. **New Event → Edit Mode**
   - [ ] Create new event
   - [ ] Confirm modal opens in Edit Mode
   - [ ] Confirm inputs are enabled
   - [ ] Confirm header shows "새 일정 추가"

---

## 7. Priority and Next Steps

**Priority**: Medium-High (UX improvement)

**Estimated Effort**: 2-3 hours

**Next Steps**:
1. Implement `isViewMode` state and initialization logic
2. Update input disabled logic across all form fields
3. Refactor header and footer rendering
4. Test all scenarios listed in Section 6
5. Update this document with completion status

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
