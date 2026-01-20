import React from 'react';
import { UserProfile, StaffMember } from '../../../types';
import DashboardHeader from '../DashboardHeader';

interface ManagerDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

/**
 * 매니저 대시보드
 * Phase 4에서 구현 예정
 */
const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ userProfile, staffMember }) => {
  return (
    <div className="w-full h-full overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-bold text-[#081429] mb-2">매니저 대시보드</h2>
          <p className="text-gray-500 mb-6">Phase 4에서 구현 예정입니다</p>
          <div className="inline-block bg-amber-50 text-amber-700 px-4 py-2 rounded-lg">
            운영 통계, 선생님별 성과, 반 관리가 표시됩니다
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
