import React, { useMemo } from 'react';
import { UserProfile, StaffMember, DashboardRole } from '../../types';
import MasterDashboard from './roles/MasterDashboard';
import TeacherDashboard from './roles/TeacherDashboard';
import StaffDashboard from './roles/StaffDashboard';
import ManagerDashboard from './roles/ManagerDashboard';

interface DashboardTabProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

/**
 * 메인 대시보드 컴포넌트
 * 사용자의 역할에 따라 적절한 대시보드를 렌더링합니다.
 *
 * 방어 로직:
 * - userProfile이 없으면 로딩 화면 표시
 * - 역할이 불명확해도 기본 대시보드 제공
 */
const DashboardTab: React.FC<DashboardTabProps> = ({ userProfile, staffMember }) => {
  // 역할 결정 로직
  // Hooks 규칙: 모든 훅은 early return 보다 먼저 호출되어야 함
  const dashboardRole: DashboardRole = useMemo(() => {
    const systemRole = userProfile?.role;
    const jobRole = staffMember?.role;

    // Master는 항상 master 대시보드
    if (systemRole === 'master') {
      return 'master';
    }

    // Manager 레벨 (admin, manager, senior_staff)
    if (systemRole && ['admin', 'manager', 'senior_staff'].includes(systemRole)) {
      return 'manager';
    }

    // 강사는 teacher 대시보드
    if (jobRole === 'teacher') {
      return 'teacher';
    }

    // 직원 (staff, admin 직무)
    if (jobRole === 'staff' || jobRole === 'admin') {
      return 'staff';
    }

    // 기본값: staff (역할이 명확하지 않은 경우)
    return 'staff';
  }, [userProfile?.role, staffMember?.role]);

  // userProfile이 없는 경우 (로딩 중이거나 오류) — 모든 훅 호출 이후 early return
  if (!userProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-sm animate-spin" />
          <span className="text-sm text-gray-500">로딩 중...</span>
        </div>
      </div>
    );
  }

  // 에러 바운더리: 렌더링 중 오류 발생 시 대체 UI
  try {
    // 역할별 대시보드 렌더링
    switch (dashboardRole) {
      case 'master':
        return <MasterDashboard userProfile={userProfile} staffMember={staffMember} />;

      case 'teacher':
        return <TeacherDashboard userProfile={userProfile} staffMember={staffMember} />;

      case 'staff':
        return <StaffDashboard userProfile={userProfile} staffMember={staffMember} />;

      case 'manager':
        return <ManagerDashboard userProfile={userProfile} staffMember={staffMember} />;

      default:
        // 알 수 없는 역할인 경우 기본 화면
        return <StaffDashboard userProfile={userProfile} staffMember={staffMember} />;
    }
  } catch (error) {
    console.error('Dashboard 렌더링 오류:', error);

    // 오류 발생 시 기본 화면 표시
    return (
      <div className="w-full h-full overflow-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-sm p-12 shadow-sm border border-gray-100 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h2 className="text-2xl font-bold text-primary mb-2">대시보드</h2>
            <p className="text-gray-500 mb-6">
              환영합니다! 좌측 메뉴에서 원하는 기능을 선택해주세요.
            </p>
            <div className="inline-block bg-blue-50 text-blue-700 px-4 py-2 rounded-sm text-sm">
              역할: {userProfile.role || '미지정'}
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export { DashboardTab };
export default DashboardTab;
