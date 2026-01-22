import React from 'react';
import { StaffMember } from '../../types';
import { Users, ChevronDown } from 'lucide-react';

interface StaffSelectorProps {
  allStaff: StaffMember[];
  selectedStaffId: string | null;
  onSelectStaff: (staffId: string | null) => void;
  currentUserName?: string;
  loading?: boolean;
}

/**
 * 직원 선택기 컴포넌트
 * MASTER/Admin이 다른 직원의 대시보드를 볼 수 있도록 하는 드롭다운
 */
const StaffSelector: React.FC<StaffSelectorProps> = ({
  allStaff,
  selectedStaffId,
  onSelectStaff,
  currentUserName,
  loading,
}) => {
  const selectedStaff = allStaff.find(s => s.id === selectedStaffId);
  const displayName = selectedStaff ? selectedStaff.name : currentUserName || '내 대시보드';

  // 직원을 역할별로 그룹화
  const staffByRole = React.useMemo(() => {
    const groups: Record<string, StaffMember[]> = {
      '원장/관리자': [],
      '강사': [],
      '직원': [],
    };

    allStaff.forEach(staff => {
      if (staff.systemRole === 'master' || staff.systemRole === 'admin') {
        groups['원장/관리자'].push(staff);
      } else if (staff.role === 'teacher' || staff.role === '강사') {
        groups['강사'].push(staff);
      } else {
        groups['직원'].push(staff);
      }
    });

    // 각 그룹 내에서 이름순 정렬
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    });

    return groups;
  }, [allStaff]);

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-[#fdb813] border-t-transparent rounded-full animate-spin" />
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Users className="w-5 h-5 text-[#081429]" />
        <span className="text-sm font-medium text-gray-600">대시보드 보기:</span>

        <div className="relative">
          <select
            value={selectedStaffId || ''}
            onChange={(e) => onSelectStaff(e.target.value || null)}
            className="appearance-none bg-[#081429] text-white pl-4 pr-10 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-[#081429]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#fdb813] min-w-[200px]"
          >
            <option value="">{currentUserName || '내 대시보드'}</option>

            {Object.entries(staffByRole).map(([role, members]) => {
              if (members.length === 0) return null;

              return (
                <optgroup key={role} label={role}>
                  {members.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.englishName ? `(${staff.englishName})` : ''}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
        </div>

        {selectedStaffId && (
          <button
            onClick={() => onSelectStaff(null)}
            className="text-xs text-gray-500 hover:text-[#fdb813] transition-colors underline"
          >
            내 대시보드로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
};

export default StaffSelector;
