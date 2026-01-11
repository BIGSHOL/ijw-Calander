# Phase 3: UsersTab Component Extraction

## Goal
Extract the User Management logic and UI from `SettingsModal.tsx` into a separate `UsersTab.tsx` component to reduce file size (~300 lines) and improve maintainability.

## User Review Required
> [!NOTE]
> No functional changes intended. This is a pure refactor.

## Proposed Changes

### 1. Create New Component: `components/settings/tabs/UsersTab.tsx`
- **Move UI**:
  - User search bar & filter tabs (Approved/Pending).
  - User list table.
  - User Detail Modal triggering logic.
- **Move State**:
  - `userSearchTerm`
  - `userTab` (Approved/Pending)
- **Props**:
  - `localUsers`: User[] (Source of truth for edits)
  - `currentUserProfile`: UserProfile
  - `isMaster`, `isAdmin`: boolean
  - `selectedUserForEdit`: string | null
  - `setSelectedUserForEdit`: (id: string | null) => void
  - `setTargetUserForEvents`: (user: UserProfile | null) => void (For "My Events" modal)
  - **Handlers**:
    - `handleUserUpdate`: To update local state in parent.
    - `handleDeptPermissionChange`
    - `handleDeleteUser` (Actually, this might remain in parent or be passed down if it affects the list directly).

### 2. Update `SettingsModal.tsx`
- Remove extracted UI code.
- Remove extracted local state (`userSearchTerm`, `userTab`).
- Render `<UsersTab />` with necessary props.
- Keep `UserDetailModal` rendering at the `SettingsModal` level (or move inside `UsersTab` if it makes more sense, but keeping it at root avoids z-index issues usually). *Correction*: `UserDetailModal` logic relies on `localDepartments` and `teachers`. It's likely better to keep the Modal rendering in `SettingsModal` for now to share the "Update" handlers easier, OR pass the handlers down to `UsersTab`.
  - *Decision*: Let's keep `UserDetailModal` rendering in `SettingsModal` to verify the isolation step by step, or better yet, move the **entire** "Users Tab Content" including the list. The Modal itself is triggered by state.

## Detailed Plan

1.  **Create `UsersTab.tsx`**:
    - Copy the `activeTab === 'users'` block.
    - Add necessary imports (`UserCog`, `Shield`, etc.).
    - Define `UsersTabProps`.

2.  **Refactor `SettingsModal.tsx`**:
    - Import `UsersTab`.
    - Replace JSX with `<UsersTab ... />`.
    - Verify `activeTab === 'users'` works.

3.  **Verification**:
    - Check User Search.
    - Check "Approved/Pending" toggle.
    - Check opening "Settings" (UserDetailModal) for a user.
    - Check "Save Changes" flow (ensure parent's `localUsers` is updated).

## Verification Plan
### Automated Tests
- None (Visual Refactor).

### Manual Verification
- [ ] Open Settings -> Users Tab.
- [ ] Test Search (e.g., "test").
- [ ] Switch between "Members" and "Requests" tabs.
- [ ] Click "Settings" on a user -> Verify Modal opens.
- [ ] Edit a user (e.g., change role) -> Verify "Save Changes" button appears in `SettingsModal` footer.
