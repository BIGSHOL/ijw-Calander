import { formatUserDisplay, staffToUserLike, staffToUserProfile } from '../../utils/staffHelpers';
import { StaffMember, UserProfile } from '../../types';

const createStaff = (overrides: Partial<StaffMember> = {}): StaffMember => ({
  id: 'staff1',
  uid: 'uid1',
  name: '김선생',
  email: 'kim@test.com',
  role: 'teacher',
  systemRole: 'math_teacher',
  approvalStatus: 'approved',
  hireDate: '2025-01-01',
  status: 'active',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  departmentPermissions: {},
  favoriteDepartments: [],
  ...overrides,
});

describe('staffHelpers', () => {
  describe('formatUserDisplay', () => {
    it('should format StaffMember with name and jobTitle', () => {
      const staff = createStaff({ jobTitle: '수학팀장' });
      expect(formatUserDisplay(staff)).toBe('김선생 (수학팀장)');
    });

    it('should format StaffMember with name only', () => {
      const staff = createStaff();
      expect(formatUserDisplay(staff)).toBe('김선생');
    });

    it('should format UserProfile with displayName and jobTitle', () => {
      const user: UserProfile = {
        uid: 'uid1',
        email: 'kim@test.com',
        displayName: '김철수',
        role: 'admin',
        status: 'approved',
        jobTitle: '관리자',
        departmentPermissions: {},
        favoriteDepartments: [],
      };
      expect(formatUserDisplay(user)).toBe('김철수 (관리자)');
    });

    it('should use email prefix when no displayName', () => {
      const user: UserProfile = {
        uid: 'uid1',
        email: 'kim@test.com',
        displayName: '',
        role: 'user',
        status: 'approved',
        departmentPermissions: {},
        favoriteDepartments: [],
      };
      expect(formatUserDisplay(user)).toBe('kim');
    });
  });

  describe('staffToUserLike', () => {
    it('should convert StaffMember to UserProfile shape', () => {
      const staff = createStaff();
      const result = staffToUserLike(staff);

      expect(result.uid).toBe('uid1');
      expect(result.email).toBe('kim@test.com');
      expect(result.displayName).toBe('김선생');
      expect(result.role).toBe('math_teacher');
      expect(result.status).toBe('approved');
      expect(result.staffId).toBe('staff1');
    });

    it('should use id when uid is missing', () => {
      const staff = createStaff({ uid: undefined });
      const result = staffToUserLike(staff);
      expect(result.uid).toBe('staff1');
    });

    it('should default to empty values for missing fields', () => {
      const staff = createStaff({
        email: undefined,
        systemRole: undefined,
        approvalStatus: undefined,
      });
      const result = staffToUserLike(staff);
      expect(result.email).toBe('');
      expect(result.role).toBe('user');
      expect(result.status).toBe('pending');
    });
  });

  describe('staffToUserProfile', () => {
    it('should convert approved staff to UserProfile with edit access', () => {
      const staff = createStaff();
      const result = staffToUserProfile(staff);

      expect(result.uid).toBe('uid1');
      expect(result.displayName).toBe('김선생');
      expect(result.role).toBe('math_teacher');
      expect(result.status).toBe('approved');
      expect(result.canEdit).toBe(true);
      expect(result.staffId).toBe('staff1');
      expect(result.allowedDepartments).toEqual([]);
    });

    it('should deny edit for user role even if approved', () => {
      const staff = createStaff({ systemRole: 'user' });
      const result = staffToUserProfile(staff);
      expect(result.canEdit).toBe(false);
    });

    it('should deny edit for pending status', () => {
      const staff = createStaff({ approvalStatus: 'pending' });
      const result = staffToUserProfile(staff);
      expect(result.canEdit).toBe(false);
    });

    it('should set departmentId from primaryDepartmentId', () => {
      const staff = createStaff({ primaryDepartmentId: 'dept1' });
      const result = staffToUserProfile(staff);
      expect(result.departmentId).toBe('dept1');
    });
  });
});
