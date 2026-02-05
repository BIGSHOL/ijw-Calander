import React from 'react';
import { UserProfile, StaffMember } from '../../../types';
import DashboardHeader from '../DashboardHeader';

interface StaffDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

/**
 * 직원 대시보드
 * Phase 4에서 구현 예정
 */
const StaffDashboard: React.FC<StaffDashboardProps> = ({ userProfile, staffMember }) => {
  return (
    <div className="w-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        <div className="bg-white rounded-sm p-12 shadow-sm border border-gray-100 text-center">
          <div className="text-6xl mb-4">💼</div>
          <h2 className="text-2xl font-bold text-[#081429] mb-2">직원 대시보드</h2>
          <p className="text-gray-500 mb-6">Phase 4에서 구현 예정입니다</p>
          <div className="inline-block bg-indigo-50 text-indigo-700 px-4 py-2 rounded-sm">
            수납 관리, 신규 등록, 상담 예약이 표시됩니다
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
