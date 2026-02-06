/**
 * Comprehensive tests for useEmbedTokens hook
 *
 * Tests cover:
 * - useEmbedTokens: CRUD operations for token management
 * - useValidateEmbedToken: Token validation logic
 * - getEmbedParams: URL parameter extraction
 * - generateEmbedUrl: Embed URL generation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmbedTokens, useValidateEmbedToken, getEmbedParams, generateEmbedUrl } from '../../hooks/useEmbedTokens';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { EmbedToken, CreateEmbedTokenInput } from '../../types/embed';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  },
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

vi.mock('../../types/embed', async () => {
  const actual = await vi.importActual('../../types/embed');
  return {
    ...actual,
    DEFAULT_EMBED_SETTINGS: {
      viewType: 'class',
      showStudentList: true,
      showTeacherInfo: true,
      showClassroom: true,
      showSchedule: true,
      showHoldStudents: false,
      showWithdrawnStudents: false,
      theme: 'light',
      compactMode: false,
    },
  };
});

describe('useEmbedTokens', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ============================================================================
  // 1. Initial State & Fetching
  // ============================================================================

  describe('Initial State & Fetching', () => {
    it('starts with loading=true, empty tokens, no error', () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
        empty: true,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      expect(result.current.loading).toBe(true);
      expect(result.current.tokens).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('fetches all tokens on mount', async () => {
      const mockTokens: EmbedToken[] = [
        {
          id: 'token1',
          type: 'math-timetable',
          name: 'Math Token',
          token: 'abcd-1234',
          createdAt: '2024-01-15T10:00:00.000Z',
          createdBy: 'staff1',
          isActive: true,
          usageCount: 5,
          settings: {
            viewType: 'class',
            showStudentList: true,
            showTeacherInfo: true,
            showClassroom: true,
            showSchedule: true,
            theme: 'light',
            compactMode: false,
          },
        },
        {
          id: 'token2',
          type: 'english-timetable',
          name: 'English Token',
          token: 'efgh-5678',
          createdAt: '2024-01-10T10:00:00.000Z',
          createdBy: 'staff2',
          isActive: false,
          usageCount: 0,
          settings: {
            viewType: 'class',
            showStudentList: true,
            showTeacherInfo: true,
            showClassroom: true,
            showSchedule: true,
            theme: 'light',
            compactMode: false,
          },
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockTokens.map((token) => ({
          id: token.id,
          data: () => ({
            type: token.type,
            name: token.name,
            token: token.token,
            createdAt: { toDate: () => new Date(token.createdAt) },
            createdBy: token.createdBy,
            isActive: token.isActive,
            usageCount: token.usageCount,
            settings: token.settings,
          }),
        })),
        empty: false,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tokens).toHaveLength(2);
      // Sorted by createdAt desc (token1 is newer)
      expect(result.current.tokens[0].id).toBe('token1');
      expect(result.current.tokens[1].id).toBe('token2');
      expect(result.current.error).toBeNull();
    });

    it('fetches tokens with type filter', async () => {
      const mockToken: EmbedToken = {
        id: 'token1',
        type: 'math-timetable',
        name: 'Math Token',
        token: 'abcd-1234',
        createdAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'staff1',
        isActive: true,
        usageCount: 0,
        settings: {
          viewType: 'class',
          showStudentList: true,
          showTeacherInfo: true,
          showClassroom: true,
          showSchedule: true,
          theme: 'light',
          compactMode: false,
        },
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: mockToken.id,
            data: () => ({
              type: mockToken.type,
              name: mockToken.name,
              token: mockToken.token,
              createdAt: { toDate: () => new Date(mockToken.createdAt) },
              createdBy: mockToken.createdBy,
              isActive: mockToken.isActive,
              usageCount: mockToken.usageCount,
              settings: mockToken.settings,
            }),
          },
        ],
        empty: false,
      } as any);

      renderHook(() => useEmbedTokens('math-timetable'));

      await waitFor(() => {
        expect(query).toHaveBeenCalled();
        expect(where).toHaveBeenCalledWith('type', '==', 'math-timetable');
      });
    });

    it('handles fetch error gracefully', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.tokens).toEqual([]);
    });

    it('handles fetch error without message', async () => {
      vi.mocked(getDocs).mockRejectedValue({ code: 'unknown' });

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch tokens');
    });

    it('sorts tokens by createdAt descending', async () => {
      const mockTokens = [
        {
          id: 'token1',
          data: () => ({
            type: 'math-timetable',
            name: 'Old Token',
            token: 'old-token',
            createdAt: { toDate: () => new Date('2024-01-01T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
        {
          id: 'token2',
          data: () => ({
            type: 'math-timetable',
            name: 'New Token',
            token: 'new-token',
            createdAt: { toDate: () => new Date('2024-01-15T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockTokens,
        empty: false,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tokens[0].name).toBe('New Token');
      expect(result.current.tokens[1].name).toBe('Old Token');
    });
  });

  // ============================================================================
  // 2. createToken
  // ============================================================================

  describe('createToken', () => {
    it('creates a new token successfully', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-token-id' } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const input: CreateEmbedTokenInput = {
        type: 'consultation-form',
        name: 'Parent Consultation',
      };

      let createdToken: EmbedToken | undefined;
      await act(async () => {
        createdToken = await result.current.createToken(input, 'staff123');
      });

      expect(addDoc).toHaveBeenCalled();
      expect(createdToken).toBeDefined();
      expect(createdToken!.id).toBe('new-token-id');
      expect(createdToken!.type).toBe('consultation-form');
      expect(createdToken!.name).toBe('Parent Consultation');
      expect(createdToken!.createdBy).toBe('staff123');
      expect(createdToken!.isActive).toBe(true);
      expect(createdToken!.usageCount).toBe(0);
      expect(createdToken!.token).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);

      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.tokens[0]).toEqual(createdToken);
    });

    it('creates token with expiresAt date', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-token-id' } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const expiresAt = '2024-12-31T23:59:59.000Z';
      const input: CreateEmbedTokenInput = {
        type: 'math-timetable',
        name: 'Temporary Token',
        expiresAt,
      };

      let createdToken: EmbedToken | undefined;
      await act(async () => {
        createdToken = await result.current.createToken(input, 'staff1');
      });

      expect(Timestamp.fromDate).toHaveBeenCalledWith(new Date(expiresAt));
      expect(createdToken!.expiresAt).toBe(expiresAt);
    });

    it('creates token with custom settings', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-token-id' } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const input: CreateEmbedTokenInput = {
        type: 'math-timetable',
        name: 'Custom Token',
        settings: {
          viewType: 'teacher',
          theme: 'dark',
          compactMode: true,
        },
      };

      let createdToken: EmbedToken | undefined;
      await act(async () => {
        createdToken = await result.current.createToken(input, 'staff1');
      });

      expect(createdToken!.settings?.viewType).toBe('teacher');
      expect(createdToken!.settings?.theme).toBe('dark');
      expect(createdToken!.settings?.compactMode).toBe(true);
      // Should merge with defaults
      expect(createdToken!.settings?.showStudentList).toBe(true);
    });

    it('adds new token to beginning of list', async () => {
      const existingToken = {
        id: 'existing-token',
        data: () => ({
          type: 'math-timetable',
          name: 'Existing',
          token: 'existing',
          createdAt: { toDate: () => new Date('2024-01-01T10:00:00.000Z') },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [existingToken],
        empty: false,
      } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'new-token-id' } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      const input: CreateEmbedTokenInput = {
        type: 'math-timetable',
        name: 'New Token',
      };

      await act(async () => {
        await result.current.createToken(input, 'staff1');
      });

      expect(result.current.tokens).toHaveLength(2);
      expect(result.current.tokens[0].id).toBe('new-token-id');
      expect(result.current.tokens[1].id).toBe('existing-token');
    });
  });

  // ============================================================================
  // 3. toggleToken
  // ============================================================================

  describe('toggleToken', () => {
    it('toggles token to inactive', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Test Token',
          token: 'test-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      await act(async () => {
        await result.current.toggleToken('token1', false);
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { isActive: false }
      );
      expect(result.current.tokens[0].isActive).toBe(false);
    });

    it('toggles token to active', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Test Token',
          token: 'test-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: false,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      await act(async () => {
        await result.current.toggleToken('token1', true);
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { isActive: true }
      );
      expect(result.current.tokens[0].isActive).toBe(true);
    });

    it('does not affect other tokens when toggling', async () => {
      const mockTokens = [
        {
          id: 'token1',
          data: () => ({
            type: 'math-timetable',
            name: 'Token 1',
            token: 'token-1',
            createdAt: { toDate: () => new Date('2024-01-15T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
        {
          id: 'token2',
          data: () => ({
            type: 'math-timetable',
            name: 'Token 2',
            token: 'token-2',
            createdAt: { toDate: () => new Date('2024-01-10T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockTokens,
        empty: false,
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(2);
      });

      await act(async () => {
        await result.current.toggleToken('token2', false);
      });

      expect(result.current.tokens[0].isActive).toBe(true); // token1 unchanged
      expect(result.current.tokens[1].isActive).toBe(false); // token2 toggled
    });
  });

  // ============================================================================
  // 4. deleteToken
  // ============================================================================

  describe('deleteToken', () => {
    it('deletes a token successfully', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Test Token',
          token: 'test-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteToken('token1');
      });

      expect(deleteDoc).toHaveBeenCalledWith(expect.anything());
      expect(doc).toHaveBeenCalledWith({}, 'embed_tokens', 'token1');
      expect(result.current.tokens).toHaveLength(0);
    });

    it('removes only the deleted token from list', async () => {
      const mockTokens = [
        {
          id: 'token1',
          data: () => ({
            type: 'math-timetable',
            name: 'Token 1',
            token: 'token-1',
            createdAt: { toDate: () => new Date('2024-01-15T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
        {
          id: 'token2',
          data: () => ({
            type: 'math-timetable',
            name: 'Token 2',
            token: 'token-2',
            createdAt: { toDate: () => new Date('2024-01-10T10:00:00.000Z') },
            createdBy: 'staff1',
            isActive: true,
            usageCount: 0,
            settings: {},
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockTokens,
        empty: false,
      } as any);

      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(2);
      });

      await act(async () => {
        await result.current.deleteToken('token1');
      });

      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.tokens[0].id).toBe('token2');
    });
  });

  // ============================================================================
  // 5. updateTokenSettings
  // ============================================================================

  describe('updateTokenSettings', () => {
    it('updates token settings successfully', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Test Token',
          token: 'test-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {
            viewType: 'class',
            showStudentList: true,
            showTeacherInfo: true,
            showClassroom: true,
            showSchedule: true,
            theme: 'light',
            compactMode: false,
          },
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      await act(async () => {
        await result.current.updateTokenSettings('token1', {
          viewType: 'teacher',
          theme: 'dark',
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          settings: {
            viewType: 'teacher',
            showStudentList: true,
            showTeacherInfo: true,
            showClassroom: true,
            showSchedule: true,
            theme: 'dark',
            compactMode: false,
          },
        }
      );

      expect(result.current.tokens[0].settings?.viewType).toBe('teacher');
      expect(result.current.tokens[0].settings?.theme).toBe('dark');
      expect(result.current.tokens[0].settings?.showStudentList).toBe(true);
    });

    it('does nothing if token not found', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateTokenSettings('non-existent', { theme: 'dark' });
      });

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('merges settings with existing settings', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Test Token',
          token: 'test-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {
            viewType: 'class',
            showStudentList: false,
            showTeacherInfo: true,
            showClassroom: true,
            showSchedule: true,
            theme: 'light',
            compactMode: false,
          },
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      await act(async () => {
        await result.current.updateTokenSettings('token1', {
          compactMode: true,
        });
      });

      expect(result.current.tokens[0].settings?.compactMode).toBe(true);
      expect(result.current.tokens[0].settings?.showStudentList).toBe(false);
      expect(result.current.tokens[0].settings?.viewType).toBe('class');
    });
  });

  // ============================================================================
  // 6. refetch
  // ============================================================================

  describe('refetch', () => {
    it('refetches tokens manually', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDocs).toHaveBeenCalledTimes(1);

      const mockToken = {
        id: 'new-token',
        data: () => ({
          type: 'math-timetable',
          name: 'New Token',
          token: 'new-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      await act(async () => {
        await result.current.refetch();
      });

      expect(getDocs).toHaveBeenCalledTimes(2);
      expect(result.current.tokens).toHaveLength(1);
    });
  });

  // ============================================================================
  // 7. docToToken conversion (edge cases)
  // ============================================================================

  describe('Document Conversion Edge Cases', () => {
    it('handles missing optional fields gracefully', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Minimal Token',
          token: 'minimal',
          createdAt: { toDate: () => new Date('2024-01-15T10:00:00.000Z') },
          createdBy: 'staff1',
          // Missing: isActive, usageCount, settings, expiresAt, lastUsedAt
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      const token = result.current.tokens[0];
      expect(token.isActive).toBe(true); // Default
      expect(token.usageCount).toBe(0); // Default
      expect(token.settings).toEqual({
        viewType: 'class',
        showStudentList: true,
        showTeacherInfo: true,
        showClassroom: true,
        showSchedule: true,
        showHoldStudents: false,
        showWithdrawnStudents: false,
        theme: 'light',
        compactMode: false,
      });
    });

    it('handles submissionCount field for consultation-form type', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'consultation-form',
          name: 'Consultation Token',
          token: 'consult',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 10,
          submissionCount: 5,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      expect(result.current.tokens[0].submissionCount).toBe(5);
    });

    it('handles timestamp fields without toDate method', async () => {
      const mockToken = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Token',
          token: 'token',
          createdAt: '2024-01-15T10:00:00.000Z', // Plain string
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        docs: [mockToken],
        empty: false,
      } as any);

      const { result } = renderHook(() => useEmbedTokens());

      await waitFor(() => {
        expect(result.current.tokens).toHaveLength(1);
      });

      expect(result.current.tokens[0].createdAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });
});

// ============================================================================
// useValidateEmbedToken Tests
// ============================================================================

describe('useValidateEmbedToken', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Invalid Token Cases', () => {
    it('returns NOT_FOUND when tokenValue is null', async () => {
      const { result } = renderHook(() => useValidateEmbedToken(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('NOT_FOUND');
      expect(result.current.token).toBeUndefined();
    });

    it('returns NOT_FOUND when token does not exist in Firestore', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const { result } = renderHook(() => useValidateEmbedToken('non-existent-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('NOT_FOUND');
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('token', '==', 'non-existent-token');
    });

    it('returns INACTIVE when token is inactive', async () => {
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Inactive Token',
          token: 'inactive-token',
          createdAt: { toDate: () => new Date('2024-01-01T10:00:00.000Z') },
          createdBy: 'staff1',
          isActive: false,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      const { result } = renderHook(() => useValidateEmbedToken('inactive-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('INACTIVE');
      expect(result.current.token).toBeDefined();
      expect(result.current.token?.name).toBe('Inactive Token');
    });

    it('returns EXPIRED when token is past expiration date', async () => {
      const pastDate = new Date('2024-01-01T10:00:00.000Z');
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Expired Token',
          token: 'expired-token',
          createdAt: { toDate: () => new Date('2023-01-01T10:00:00.000Z') },
          createdBy: 'staff1',
          isActive: true,
          expiresAt: { toDate: () => pastDate },
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      const { result } = renderHook(() => useValidateEmbedToken('expired-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('EXPIRED');
      expect(result.current.token).toBeDefined();
    });

    it('handles validation error gracefully', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useValidateEmbedToken('some-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('NOT_FOUND');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Token validation error:',
        expect.any(Error)
      );
    });
  });

  describe('Valid Token Cases', () => {
    it('validates active token without expiration', async () => {
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Valid Token',
          token: 'valid-token',
          createdAt: { toDate: () => new Date('2024-01-01T10:00:00.000Z') },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 5,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useValidateEmbedToken('valid-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(true);
      expect(result.current.error).toBeUndefined();
      expect(result.current.token).toBeDefined();
      expect(result.current.token?.name).toBe('Valid Token');
    });

    it('validates token with future expiration date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Future Token',
          token: 'future-token',
          createdAt: { toDate: () => new Date('2024-01-01T10:00:00.000Z') },
          createdBy: 'staff1',
          isActive: true,
          expiresAt: { toDate: () => futureDate },
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useValidateEmbedToken('future-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('updates usage count and lastUsedAt on successful validation', async () => {
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Token',
          token: 'valid-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 10,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      renderHook(() => useValidateEmbedToken('valid-token'));

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          {
            lastUsedAt: 'server-timestamp',
            usageCount: 11,
          }
        );
      });
    });

    it('validates successfully even if usage update fails', async () => {
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Token',
          token: 'valid-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          usageCount: 0,
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      vi.mocked(updateDoc).mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useValidateEmbedToken('valid-token'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isValid).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('handles missing usageCount field', async () => {
      const mockTokenDoc = {
        id: 'token1',
        data: () => ({
          type: 'math-timetable',
          name: 'Token',
          token: 'valid-token',
          createdAt: { toDate: () => new Date() },
          createdBy: 'staff1',
          isActive: true,
          // usageCount missing
          settings: {},
        }),
      };

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [mockTokenDoc],
      } as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      renderHook(() => useValidateEmbedToken('valid-token'));

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          {
            lastUsedAt: 'server-timestamp',
            usageCount: 1, // 0 + 1
          }
        );
      });
    });
  });
});

// ============================================================================
// getEmbedParams Tests
// ============================================================================

describe('getEmbedParams', () => {
  let originalWindow: typeof window;

  beforeEach(() => {
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('returns embed and token from URL search params', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        search: '?embed=math-timetable&token=abc123',
      },
      writable: true,
    });

    const params = getEmbedParams();

    expect(params.embed).toBe('math-timetable');
    expect(params.token).toBe('abc123');
  });

  it('returns null values when params not present', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        search: '',
      },
      writable: true,
    });

    const params = getEmbedParams();

    expect(params.embed).toBeNull();
    expect(params.token).toBeNull();
  });

  it('returns null values when window is undefined (SSR)', () => {
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    const params = getEmbedParams();

    expect(params.embed).toBeNull();
    expect(params.token).toBeNull();
  });

  it('handles partial params', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        search: '?embed=english-timetable',
      },
      writable: true,
    });

    const params = getEmbedParams();

    expect(params.embed).toBe('english-timetable');
    expect(params.token).toBeNull();
  });

  it('handles URL with other params', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        search: '?foo=bar&embed=consultation-form&token=xyz789&baz=qux',
      },
      writable: true,
    });

    const params = getEmbedParams();

    expect(params.embed).toBe('consultation-form');
    expect(params.token).toBe('xyz789');
  });
});

// ============================================================================
// generateEmbedUrl Tests
// ============================================================================

describe('generateEmbedUrl', () => {
  let originalWindow: typeof window;

  beforeEach(() => {
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('generates correct embed URL', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
    });

    const url = generateEmbedUrl('math-timetable', 'abc123');

    expect(url).toBe('https://example.com/?embed=math-timetable&token=abc123');
  });

  it('handles different embed types', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
    });

    const mathUrl = generateEmbedUrl('math-timetable', 'token1');
    const englishUrl = generateEmbedUrl('english-timetable', 'token2');
    const consultUrl = generateEmbedUrl('consultation-form', 'token3');

    expect(mathUrl).toContain('embed=math-timetable');
    expect(englishUrl).toContain('embed=english-timetable');
    expect(consultUrl).toContain('embed=consultation-form');
  });

  it('returns empty origin when window is undefined (SSR)', () => {
    // @ts-expect-error - Simulating SSR
    global.window = undefined;

    const url = generateEmbedUrl('math-timetable', 'abc123');

    expect(url).toBe('/?embed=math-timetable&token=abc123');
  });

  it('handles special characters in token', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
    });

    const url = generateEmbedUrl('math-timetable', 'token-with-special!@#');

    expect(url).toContain('token=token-with-special!@#');
  });

  it('uses HTTPS origin correctly', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'https://secure.example.com:8443',
      },
      writable: true,
    });

    const url = generateEmbedUrl('math-timetable', 'secure-token');

    expect(url).toBe('https://secure.example.com:8443/?embed=math-timetable&token=secure-token');
  });

  it('uses HTTP origin correctly', () => {
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    });

    const url = generateEmbedUrl('consultation-form', 'dev-token');

    expect(url).toBe('http://localhost:3000/?embed=consultation-form&token=dev-token');
  });
});
