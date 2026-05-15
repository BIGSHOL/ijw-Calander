import React, { useMemo, useState } from 'react';
import { UserProfile, StaffMember, DashboardRole } from '../../types';
import MasterDashboard from './roles/MasterDashboard';
import TeacherDashboard from './roles/TeacherDashboard';
import StaffDashboard from './roles/StaffDashboard';
import ManagerDashboard from './roles/ManagerDashboard';
import StaffSelector from './StaffSelector';
import { useStaff } from '../../hooks/useStaff';
import { usePermissions } from '../../hooks/usePermissions';

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
  // 다른 직원 대시보드 보기 상태 (MASTER, Admin만 가능)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const { staff: allStaff, loading: staffLoading } = useStaff();

  // 다른 직원 대시보드 보기 권한 확인
  // Hooks 규칙: 모든 훅은 early return 보다 먼저 호출되어야 함
  const { hasPermission } = usePermissions(userProfile);
  const canViewOtherDashboards = hasPermission('users.view');

  // 선택된 직원 정보 가져오기
  const selectedStaff = useMemo(() => {
    if (!selectedStaffId || !allStaff) return null;
    return allStaff.find(s => s.id === selectedStaffId);
  }, [selectedStaffId, allStaff]);

  // 표시할 직원 정보 결정 (선택된 직원 또는 본인)
  const displayStaffMember = selectedStaff || staffMember;
  const displayUserProfile = selectedStaff
    ? { ...userProfile, role: selectedStaff.systemRole || 'user' } as UserProfile
    : userProfile;

  // 강사 여부 확인 (직원 관리의 role 체크)
  const isTeacher = displayStaffMember?.role === 'teacher' || displayStaffMember?.role === '강사';

  // 역할 결정 로직 (직무 역할 우선, 시스템 역할 보조)
  const dashboardRole: DashboardRole = useMemo(() => {
    const systemRole = displayUserProfile?.role;

    // 직원 관리에서 '강사'로 체크된 경우 무조건 teacher 대시보드
    if (isTeacher) {
      return 'teacher';
    }

    // Master와 Admin은 같은 master 대시보드
    if (systemRole === 'master' || systemRole === 'admin') {
      return 'master';
    }

    // Manager 레벨 (manager, senior_staff)
    if (systemRole && ['manager', 'senior_staff'].includes(systemRole)) {
      return 'manager';
    }

    // Teacher 시스템 역할
    if (systemRole === 'teacher') {
      return 'teacher';
    }

    // Staff 및 기타 역할
    if (systemRole === 'staff' || systemRole === 'user') {
      return 'staff';
    }

    // 기본값: staff (역할이 명확하지 않은 경우)
    return 'staff';
  }, [displayUserProfile?.role, isTeacher]);

  // 추가 대시보드 결정 (강사이면서 동시에 다른 시스템 역할인 경우)
  const additionalRole: DashboardRole | null = useMemo(() => {
    if (!isTeacher) return null;

    const systemRole = displayUserProfile?.role;

    // 강사이면서 동시에 다른 역할인 경우
    if (systemRole === 'master' || systemRole === 'admin') {
      return 'master';
    }

    if (systemRole && ['manager', 'senior_staff'].includes(systemRole)) {
      return 'manager';
    }

    if (systemRole === 'staff' || systemRole === 'user') {
      return 'staff';
    }

    return null;
  }, [displayUserProfile?.role, isTeacher]);

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
    const dashboardContent = (() => {
      switch (dashboardRole) {
        case 'master':
          return <MasterDashboard userProfile={displayUserProfile} staffMember={displayStaffMember} />;

        case 'teacher':
          return <TeacherDashboard userProfile={displayUserProfile} staffMember={displayStaffMember} />;

        case 'staff':
          return <StaffDashboard userProfile={displayUserProfile} staffMember={displayStaffMember} />;

        case 'manager':
          return <ManagerDashboard userProfile={displayUserProfile} staffMember={displayStaffMember} />;

        default:
          // 알 수 없는 역할인 경우 기본 화면
          return <StaffDashboard userProfile={displayUserProfile} staffMember={displayStaffMember} />;
      }
    })();

    // MASTER/Admin은 직원 선택기와 함께 렌더링
    if (canViewOtherDashboards) {
      return (
        <>
          <StaffSelector
            allStaff={allStaff || []}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            currentUserName={staffMember?.name}
            loading={staffLoading}
          />
          <div className="w-full bg-gray-50 p-6">
            {dashboardContent}
          </div>
        </>
      );
    }

    // 일반 사용자는 본인 대시보드만
    return dashboardContent;
  } catch (error) {
    console.error('Dashboard 렌더링 오류:', error);

    // 오류 발생 시 기본 화면 표시
    return (
      <div className="w-full p-6 bg-gray-50">
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

export default DashboardTab;
