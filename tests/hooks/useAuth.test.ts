import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  auth: {},
  db: {},
}));

vi.mock('../../queryClient', () => ({
  queryClient: {
    cancelQueries: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../../utils/staffHelpers', () => ({
  staffToUserProfile: vi.fn((staff) => ({
    uid: staff.uid || 'test-uid',
    email: staff.email || 'test@test.com',
    role: staff.systemRole || 'user',
    status: staff.approvalStatus || 'approved',
    displayName: staff.name || 'Test User',
    staffId: staff.id,
  })),
  createNewStaffMember: vi.fn(async (user, isMaster) => ({
    id: 'new-staff-id',
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email?.split('@')[0],
    systemRole: isMaster ? 'master' : 'user',
    approvalStatus: isMaster ? 'approved' : 'pending',
  })),
}));

vi.mock('../../utils/localStorage', () => ({
  storage: {
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    DEPT_HIDDEN_IDS: 'dept_hidden_ids',
  },
}));

describe('useAuth', () => {
  const mockSetCurrentUser = vi.fn();
  const mockOnShowLogin = vi.fn();

  const defaultParams = {
    setCurrentUser: mockSetCurrentUser,
    systemConfig: { masterEmails: ['master@test.com'] },
    onShowLogin: mockOnShowLogin,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Default: onAuthStateChanged returns an unsubscribe function
    (onAuthStateChanged as any).mockReturnValue(vi.fn());
    (signOut as any).mockResolvedValue(undefined);
  });

  describe('Initial state', () => {
    it('초기 상태에서 authLoading이 true여야 함', () => {
      const { result } = renderHook(() => useAuth(defaultParams));

      expect(result.current.authLoading).toBe(true);
      expect(result.current.userProfile).toBeNull();
    });

    it('useAuth가 필요한 값들을 반환해야 함', () => {
      const { result } = renderHook(() => useAuth(defaultParams));

      expect(result.current).toHaveProperty('userProfile');
      expect(result.current).toHaveProperty('setUserProfile');
      expect(result.current).toHaveProperty('authLoading');
      expect(result.current).toHaveProperty('handleLogout');
    });
  });

  describe('Auth listener setup', () => {
    it('마운트 시 onAuthStateChanged를 호출해야 함', () => {
      renderHook(() => useAuth(defaultParams));

      expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    });

    it('언마운트 시 unsubscribe를 호출해야 함', () => {
      const unsubscribe = vi.fn();
      (onAuthStateChanged as any).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useAuth(defaultParams));
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Unauthenticated user', () => {
    it('user가 null이면 onShowLogin을 호출하고 authLoading을 false로', async () => {
      // onAuthStateChanged callback에 null을 전달
      (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
        callback(null);
        return vi.fn();
      });

      const { result } = renderHook(() => useAuth(defaultParams));

      await waitFor(() => {
        expect(result.current.authLoading).toBe(false);
      });

      expect(mockSetCurrentUser).toHaveBeenCalledWith(null);
      expect(mockOnShowLogin).toHaveBeenCalled();
      expect(result.current.userProfile).toBeNull();
    });
  });

  describe('handleLogout', () => {
    it('로그아웃 시 signOut을 호출하고 프로필을 초기화해야 함', async () => {
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      const { result } = renderHook(() => useAuth(defaultParams));

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(signOut).toHaveBeenCalled();
      expect(result.current.userProfile).toBeNull();
    });
  });

  describe('setUserProfile', () => {
    it('setUserProfile로 프로필을 수동 설정 가능', () => {
      const { result } = renderHook(() => useAuth(defaultParams));

      act(() => {
        result.current.setUserProfile({
          uid: 'test-uid',
          email: 'test@test.com',
          role: 'admin',
          status: 'approved',
        });
      });

      expect(result.current.userProfile).toEqual({
        uid: 'test-uid',
        email: 'test@test.com',
        role: 'admin',
        status: 'approved',
      });
    });
  });
});
