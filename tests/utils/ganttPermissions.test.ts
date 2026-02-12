import {
  checkProjectAccess,
  filterAccessibleProjects,
  canAddMember,
  getMemberRoleDisplayName,
  getMemberRoleColor,
} from '../../utils/ganttPermissions';
import { GanttTemplate, UserProfile, ProjectMemberRole } from '../../types';

const createUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'user1',
  email: 'test@test.com',
  displayName: '테스트',
  role: 'staff',
  status: 'approved',
  canEdit: true,
  ...overrides,
});

const createProject = (overrides: Partial<GanttTemplate> = {}): GanttTemplate => ({
  id: 'proj1',
  name: '테스트 프로젝트',
  tasks: [],
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  createdBy: 'otherUser',
  ...overrides,
} as GanttTemplate);

describe('ganttPermissions', () => {
  describe('checkProjectAccess', () => {
    it('인증되지 않은 사용자는 접근 불가', () => {
      const result = checkProjectAccess(createProject(), null);
      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.accessReason).toBe('Not authenticated');
    });

    it('master 역할은 모든 권한 보유', () => {
      const user = createUser({ role: 'master' });
      const result = checkProjectAccess(createProject(), user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.canDelete).toBe(true);
      expect(result.canManageMembers).toBe(true);
      expect(result.accessReason).toBe('Master role');
    });

    it('admin은 조회/편집 가능, 자기 프로젝트만 삭제 가능', () => {
      const user = createUser({ uid: 'admin1', role: 'admin' });
      const ownProject = createProject({ createdBy: 'admin1' });
      const otherProject = createProject({ createdBy: 'other' });

      const ownResult = checkProjectAccess(ownProject, user);
      expect(ownResult.canDelete).toBe(true);

      const otherResult = checkProjectAccess(otherProject, user);
      expect(otherResult.canView).toBe(true);
      expect(otherResult.canEdit).toBe(true);
      expect(otherResult.canDelete).toBe(false);
    });

    it('프로젝트 소유자(ownerId)는 모든 권한 보유', () => {
      const user = createUser({ uid: 'owner1' });
      const project = createProject({ ownerId: 'owner1' });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.canDelete).toBe(true);
      expect(result.accessReason).toBe('Project owner');
    });

    it('프로젝트 생성자(createdBy)도 소유자 권한', () => {
      const user = createUser({ uid: 'creator1' });
      const project = createProject({ createdBy: 'creator1' });
      const result = checkProjectAccess(project, user);
      expect(result.accessReason).toBe('Project owner');
    });

    it('멤버 역할에 따른 권한 - editor', () => {
      const user = createUser({ uid: 'member1' });
      const project = createProject({
        members: [{ userId: 'member1', role: 'editor' } as any],
      });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.canDelete).toBe(false);
      expect(result.canManageMembers).toBe(false);
    });

    it('멤버 역할에 따른 권한 - viewer', () => {
      const user = createUser({ uid: 'member1' });
      const project = createProject({
        members: [{ userId: 'member1', role: 'viewer' } as any],
      });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
    });

    it('멤버 역할에 따른 권한 - admin', () => {
      const user = createUser({ uid: 'member1' });
      const project = createProject({
        members: [{ userId: 'member1', role: 'admin' } as any],
      });
      const result = checkProjectAccess(project, user);
      expect(result.canManageMembers).toBe(true);
    });

    it('팀장 역할은 부서 프로젝트 조회 가능', () => {
      const user = createUser({ uid: 'lead1', role: 'manager' });
      const project = createProject({
        visibility: 'department',
        departmentIds: ['dept1'],
      });
      const result = checkProjectAccess(project, user, ['dept1']);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.accessReason).toBe('Team lead - department access');
    });

    it('public 프로젝트는 승인된 사용자 조회 가능', () => {
      const user = createUser({ status: 'approved' });
      const project = createProject({ visibility: 'public' });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
    });

    it('department 프로젝트는 같은 부서만 조회 가능', () => {
      const user = createUser();
      const project = createProject({
        visibility: 'department',
        departmentIds: ['dept1'],
      });
      const withAccess = checkProjectAccess(project, user, ['dept1']);
      expect(withAccess.canView).toBe(true);

      const noAccess = checkProjectAccess(project, user, ['dept2']);
      expect(noAccess.canView).toBe(false);
    });

    it('레거시 assignees 체크', () => {
      const user = createUser({ uid: 'user1' });
      const project = createProject({ assignees: ['user1'] });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.accessReason).toBe('Legacy assignee');
    });

    it('레거시 isShared 체크', () => {
      const user = createUser();
      const project = createProject({ isShared: true } as any);
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.accessReason).toBe('Legacy shared');
    });

    it('접근 권한 없는 경우', () => {
      const user = createUser();
      const project = createProject({ visibility: 'private' as any });
      const result = checkProjectAccess(project, user);
      expect(result.canView).toBe(false);
      expect(result.accessReason).toBe('No access');
    });
  });

  describe('filterAccessibleProjects', () => {
    it('인증되지 않으면 빈 배열 반환', () => {
      const result = filterAccessibleProjects([createProject()], null);
      expect(result).toEqual([]);
    });

    it('접근 가능한 프로젝트만 필터링', () => {
      const user = createUser({ uid: 'user1' });
      const projects = [
        createProject({ id: 'p1', visibility: 'public' }),
        createProject({ id: 'p2', visibility: 'private' as any }),
      ];
      const result = filterAccessibleProjects(projects, user);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
  });

  describe('canAddMember', () => {
    it('인증되지 않으면 false', () => {
      expect(canAddMember(createProject(), null)).toBe(false);
    });

    it('master는 멤버 추가 가능', () => {
      const user = createUser({ role: 'master' });
      expect(canAddMember(createProject(), user)).toBe(true);
    });

    it('일반 viewer 멤버는 멤버 추가 불가', () => {
      const user = createUser({ uid: 'v1' });
      const project = createProject({
        members: [{ userId: 'v1', role: 'viewer' } as any],
      });
      expect(canAddMember(project, user)).toBe(false);
    });
  });

  describe('getMemberRoleDisplayName', () => {
    it('역할별 한글 이름 반환', () => {
      expect(getMemberRoleDisplayName('owner')).toBe('소유자');
      expect(getMemberRoleDisplayName('admin')).toBe('관리자');
      expect(getMemberRoleDisplayName('editor')).toBe('편집자');
      expect(getMemberRoleDisplayName('viewer')).toBe('관찰자');
    });
  });

  describe('getMemberRoleColor', () => {
    it('역할별 색상 반환', () => {
      expect(getMemberRoleColor('owner')).toContain('yellow');
      expect(getMemberRoleColor('admin')).toContain('purple');
      expect(getMemberRoleColor('editor')).toContain('blue');
      expect(getMemberRoleColor('viewer')).toContain('slate');
    });
  });
});