import React from 'react';
import { UserProfile, StaffMember } from '../../../types';
import DashboardHeader from '../DashboardHeader';

interface TeacherDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

/**
 * 강사 대시보드
 * Phase 3에서 구현 예정
 */
const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ userProfile, staffMember }) => {
  return (
    <div className="w-full h-full overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-[#081429] mb-2">강사 대시보드</h2>
          <p className="text-gray-500 mb-6">Phase 3에서 구현 예정입니다</p>
          <div className="inline-block bg-green-50 text-green-700 px-4 py-2 rounded-lg">
            내 수업, 내 학생, 상담 일정이 표시됩니다
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
