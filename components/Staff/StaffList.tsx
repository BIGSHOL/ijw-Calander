import React, { useState, useMemo } from 'react';
import { Phone, ChevronLeft, ChevronRight, User, Shield, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, ROLE_LABELS, UserRole } from '../../types';

interface StaffListProps {
  staff: StaffMember[];
  selectedStaff: StaffMember | null;
  onSelectStaff: (staff: StaffMember) => void;
}

const StaffList: React.FC<StaffListProps> = ({
  staff,
  selectedStaff,
  onSelectStaff,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Pagination
  const totalPages = Math.ceil(staff.length / pageSize);
  const paginatedStaff = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return staff.slice(startIndex, startIndex + pageSize);
  }, [staff, currentPage, pageSize]);

  // Reset page when staff changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [staff.length]);

  const getStatusBadge = (status: StaffMember['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      resigned: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xxs px-1.5 py-0.5 rounded font-medium ${styles[status]}`}>
        {STAFF_STATUS_LABELS[status]}
      </span>
    );
  };

  const getRoleBadge = (role: StaffMember['role']) => {
    const styles = {
      teacher: 'bg-blue-100 text-blue-800',
      admin: 'bg-purple-100 text-purple-800',
      staff: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xxs px-1.5 py-0.5 rounded font-medium ${styles[role]}`}>
        {STAFF_ROLE_LABELS[role]}
      </span>
    );
  };

  // 시스템 역할 스타일
  const getSystemRoleStyle = (role?: UserRole) => {
    if (!role) return null;
    const styles: Record<UserRole, { icon: React.ReactNode; color: string }> = {
      master: { icon: <ShieldCheck className="w-3 h-3" />, color: 'text-amber-600' },
      admin: { icon: <Shield className="w-3 h-3" />, color: 'text-purple-600' },
      manager: { icon: <Shield className="w-3 h-3" />, color: 'text-blue-600' },
      math_lead: { icon: <User className="w-3 h-3" />, color: 'text-blue-600' },
      english_lead: { icon: <User className="w-3 h-3" />, color: 'text-pink-600' },
      math_teacher: { icon: <User className="w-3 h-3" />, color: 'text-blue-500' },
      english_teacher: { icon: <User className="w-3 h-3" />, color: 'text-pink-500' },
      user: { icon: <User className="w-3 h-3" />, color: 'text-gray-600' },
      teacher: { icon: <User className="w-3 h-3" />, color: 'text-green-600' },
      staff: { icon: <User className="w-3 h-3" />, color: 'text-gray-500' },
      editor: { icon: <User className="w-3 h-3" />, color: 'text-blue-500' },
      senior_staff: { icon: <User className="w-3 h-3" />, color: 'text-indigo-600' },
      viewer: { icon: <User className="w-3 h-3" />, color: 'text-yellow-600' },
    };
    return styles[role];
  };

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <User className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">등록된 직원이 없습니다</p>
        <p className="text-sm">상단의 '직원 추가' 버튼을 클릭하여 직원을 등록하세요</p>
      </div>
    );
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, staff.length);
  const total = staff.length;

  return (
    <div className="space-y-2">
      {/* Table */}
      <div className="rounded-sm shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: 'rgba(8, 20, 41, 0.15)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  이름
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  직책
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  호칭
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  전화번호
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  담당과목
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  시간표 정보
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  입사일
                </th>
                <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  상태
                </th>
                <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                  시스템 계정
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedStaff.map((member, idx) => (
                <tr
                  key={member.id}
                  onClick={() => onSelectStaff(member)}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer group ${selectedStaff?.id === member.id ? 'bg-accent/10' : ''}`}
                  style={{ backgroundColor: selectedStaff?.id === member.id ? undefined : (idx % 2 === 0 ? 'white' : '#fafafa') }}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-medium flex-shrink-0"
                        style={{
                          backgroundColor: member.role === 'teacher' && member.bgColor ? member.bgColor : '#081429',
                          color: member.role === 'teacher' && member.textColor ? member.textColor : '#ffffff'
                        }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-primary truncate">
                          {member.name}
                          {member.englishName && (
                            <span className="ml-1 text-xxs text-gray-500 font-normal">({member.englishName})</span>
                          )}
                        </div>
                        {member.email && (
                          <div className="text-xxs text-gray-500 truncate">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {getRoleBadge(member.role)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {member.jobTitle ? (
                      <span className="text-[11px] text-gray-700">{member.jobTitle}</span>
                    ) : (
                      <span className="text-xxs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {member.phone ? (
                      <span className="text-[11px] text-gray-600">{member.phone}</span>
                    ) : (
                      <span className="text-xxs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    <div className="flex gap-0.5">
                      {member.subjects?.map((subject) => (
                        <span
                          key={subject}
                          className={`text-xxs px-1.5 py-0.5 rounded ${subject === 'math'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-pink-100 text-pink-700'
                            }`}
                        >
                          {subject === 'math' ? '수학' : '영어'}
                        </span>
                      ))}
                      {(!member.subjects || member.subjects.length === 0) && (
                        <span className="text-xxs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {member.role === 'teacher' ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {member.bgColor && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-4 h-4 rounded border border-gray-300 flex items-center justify-center text-micro font-bold"
                              style={{
                                backgroundColor: member.bgColor,
                                color: member.textColor || '#ffffff'
                              }}
                              title={`배경: ${member.bgColor}`}
                            >
                              A
                            </div>
                            <span className="text-xxs text-gray-500">{member.bgColor}</span>
                          </div>
                        )}
                        {member.defaultRoom && (
                          <span className="text-xxs text-gray-600">
                            강의실: <span className="font-medium">{member.defaultRoom}</span>
                          </span>
                        )}
                        {member.isNative && (
                          <span className="text-xxs px-1 py-0.5 bg-purple-100 text-purple-700 rounded">
                            원어민
                          </span>
                        )}
                        {member.isHiddenInTimetable && (
                          <span className="text-xxs px-1 py-0.5 bg-gray-100 text-gray-600 rounded">
                            숨김
                          </span>
                        )}
                        {!member.bgColor && !member.defaultRoom && !member.isNative && !member.isHiddenInTimetable && (
                          <span className="text-xxs text-gray-400">-</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xxs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                    {member.hireDate}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {getStatusBadge(member.status)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                    {member.uid ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-0.5">
                          {(() => {
                            const style = getSystemRoleStyle(member.systemRole);
                            if (!style) return <CheckCircle className="w-3 h-3 text-emerald-600" />;
                            return (
                              <>
                                <span className={style.color}>{style.icon}</span>
                                <span className={`text-xxs font-medium ${style.color}`}>
                                  {ROLE_LABELS[member.systemRole as keyof typeof ROLE_LABELS] || member.systemRole}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                        <span className={`text-micro px-1 py-0.5 rounded ${
                          member.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          member.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {member.approvalStatus === 'approved' ? '승인됨' :
                           member.approvalStatus === 'pending' ? '대기중' : '차단됨'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xxs text-gray-400 flex items-center justify-center gap-0.5">
                        <XCircle className="w-3 h-3" />
                        미연동
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Bottom */}
      <div className="p-3 rounded-sm shadow-sm border flex items-center justify-between" style={{ backgroundColor: 'white', borderColor: 'rgba(8, 20, 41, 0.15)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>페이지당</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 text-xs rounded-sm border transition-all"
            style={{ borderColor: 'rgba(8, 20, 41, 0.2)', color: 'rgb(8, 20, 41)' /* primary */, backgroundColor: 'white' }}
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
          <span className="text-xs hidden sm:inline" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
            {start}-{end} / 총 {total}개
          </span>
        </div>
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
            style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
          >
            이전
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                    currentPage === pageNum
                      ? 'text-primary'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={currentPage === pageNum ? { backgroundColor: 'rgb(253, 184, 19)' /* accent */ } : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
            style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
          >
            다음
          </button>
        </nav>
      </div>
    </div>
  );
};

export default StaffList;
