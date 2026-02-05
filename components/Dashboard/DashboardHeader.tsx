import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { UserProfile, StaffMember } from '../../types';
import { RefreshCw } from 'lucide-react';

interface DashboardHeaderProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
  onRefresh?: () => void;
}

/**
 * 대시보드 헤더 컴포넌트
 * 인사말, 날짜, 새로고침 버튼
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userProfile,
  staffMember,
  onRefresh
}) => {
  const today = new Date();
  const formattedDate = format(today, 'yyyy년 M월 d일 EEEE', { locale: ko });

  // 사용자 이름 가져오기
  const userName = staffMember?.name || userProfile.displayName || userProfile.email.split('@')[0];

  // 호칭 가져오기
  const jobTitle = staffMember?.jobTitle || userProfile.jobTitle;

  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
      <div>
        <h1 className="text-2xl font-bold text-primary mb-1">
          {jobTitle ? `${userName} ${jobTitle}` : userName}님, 안녕하세요! 👋
        </h1>
        <p className="text-sm text-gray-500">{formattedDate}</p>
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-100 rounded-sm transition-colors"
          title="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
          <span>새로고침</span>
        </button>
      )}
    </div>
  );
};

export default DashboardHeader;
