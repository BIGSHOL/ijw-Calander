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
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status]}`}>
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
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[role]}`}>
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Pagination - Top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">페이지당</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-sm text-gray-600">
              {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, staff.length)} / {staff.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                이름
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                직책
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                전화번호
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                담당과목
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                시간표 정보
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                입사일
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#373d41]">
                상태
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-[#373d41]">
                시스템 계정
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedStaff.map((member) => (
              <tr
                key={member.id}
                onClick={() => onSelectStaff(member)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer group ${selectedStaff?.id === member.id ? 'bg-[#fdb813]/10' : ''
                  }`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                      style={{
                        backgroundColor: member.role === 'teacher' && member.bgColor ? member.bgColor : '#081429',
                        color: member.role === 'teacher' && member.textColor ? member.textColor : '#ffffff'
                      }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-[#081429]">
                        {member.name}
                        {member.englishName && (
                          <span className="ml-2 text-xs text-gray-500 font-normal">({member.englishName})</span>
                        )}
                      </div>
                      {member.email && (
                        <div className="text-xs text-gray-500">{member.email}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {getRoleBadge(member.role)}
                </td>
                <td className="px-4 py-2.5">
                  {member.phone ? (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone className="w-3 h-3" />
                      <span>{member.phone}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {member.subjects?.map((subject) => (
                      <span
                        key={subject}
                        className={`text-xs px-2 py-0.5 rounded ${subject === 'math'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-pink-100 text-pink-700'
                          }`}
                      >
                        {subject === 'math' ? '수학' : '영어'}
                      </span>
                    ))}
                    {(!member.subjects || member.subjects.length === 0) && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {member.role === 'teacher' ? (
                    <div className="flex flex-col gap-1">
                      {/* 색상 미리보기 */}
                      {member.bgColor && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{
                              backgroundColor: member.bgColor,
                              color: member.textColor || '#ffffff'
                            }}
                            title={`배경: ${member.bgColor}, 글자: ${member.textColor || '#ffffff'}`}
                          >
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                              A
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">{member.bgColor}</span>
                        </div>
                      )}
                      {/* 기본 강의실 */}
                      {member.defaultRoom && (
                        <span className="text-xs text-gray-600">
                          강의실: <span className="font-medium">{member.defaultRoom}</span>
                        </span>
                      )}
                      {/* 원어민 / 숨김 표시 */}
                      <div className="flex gap-1">
                        {member.isNative && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            원어민
                          </span>
                        )}
                        {member.isHiddenInTimetable && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            숨김
                          </span>
                        )}
                      </div>
                      {/* 아무것도 없으면 - 표시 */}
                      {!member.bgColor && !member.defaultRoom && !member.isNative && !member.isHiddenInTimetable && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {member.hireDate}
                </td>
                <td className="px-4 py-2.5">
                  {getStatusBadge(member.status)}
                </td>
                {/* 시스템 계정 - staff 데이터 기반 */}
                <td className="px-4 py-2.5 text-center">
                  {member.uid ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        {(() => {
                          const style = getSystemRoleStyle(member.systemRole);
                          if (!style) return <CheckCircle className="w-3 h-3 text-emerald-600" />;
                          return (
                            <>
                              <span className={style.color}>{style.icon}</span>
                              <span className={`text-xs font-medium ${style.color}`}>
                                {ROLE_LABELS[member.systemRole as keyof typeof ROLE_LABELS] || member.systemRole}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        member.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        member.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {member.approvalStatus === 'approved' ? '승인됨' :
                         member.approvalStatus === 'pending' ? '대기중' : '차단됨'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
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
  );
};

export default StaffList;
