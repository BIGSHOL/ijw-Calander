import React, { useState, useRef, useEffect } from 'react';
import { StaffMember } from '../../types';
import { Users, ChevronDown } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedStaff = allStaff.find(s => s.id === selectedStaffId);
  const displayName = selectedStaff
    ? `${selectedStaff.name}${selectedStaff.englishName ? ` (${selectedStaff.englishName})` : ''}`
    : currentUserName || '내 대시보드';

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

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  if (loading) {
    return (
      <TabSubNavigation variant="compact" className="px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-[#fdb813] border-t-transparent rounded-full animate-spin" />
          로딩 중...
        </div>
      </TabSubNavigation>
    );
  }

  return (
    <TabSubNavigation variant="compact" className="px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-white" />
        <span className="text-sm font-medium text-white">대시보드 보기:</span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-[#081429] text-white pl-4 pr-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-[#081429]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#fdb813] min-w-[200px]"
          >
            <span className="flex-1 text-left">{displayName}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 min-w-[600px] max-h-[400px] overflow-y-auto">
              {/* 내 대시보드 */}
              <div className="p-1.5 border-b border-gray-200">
                <TabButton
                  active={!selectedStaffId}
                  onClick={() => {
                    onSelectStaff(null);
                    setShowDropdown(false);
                  }}
                  className="w-full px-2 py-1 text-left"
                >
                  {currentUserName || '내 대시보드'}
                </TabButton>
              </div>

              <div className="p-1.5">
                {Object.entries(staffByRole).map(([role, members]) => {
                  if (members.length === 0) return null;

                  const roleColor = role === '원장/관리자' ? 'red' : role === '강사' ? 'blue' : 'gray';

                  return (
                    <div key={role} className="mb-2">
                      <div className={`text-[10px] text-${roleColor}-600 font-bold px-1.5 py-0.5 border-b border-gray-200 mb-0.5`}>
                        {role}
                      </div>
                      <div className="grid grid-cols-5 gap-0.5">
                        {members.map(staff => (
                          <TabButton
                            key={staff.id}
                            active={selectedStaffId === staff.id}
                            onClick={() => {
                              onSelectStaff(staff.id);
                              setShowDropdown(false);
                            }}
                            className="px-1.5 py-1 text-[11px] text-left truncate"
                            title={`${staff.name}${staff.englishName ? ` (${staff.englishName})` : ''}`}
                          >
                            <div className="font-medium truncate">{staff.name}</div>
                          </TabButton>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
    </TabSubNavigation>
  );
};

export default StaffSelector;
