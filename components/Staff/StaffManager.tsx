import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, RefreshCw, Calendar, Briefcase, AlertCircle, Database } from 'lucide-react';
import { useStaff } from '../../hooks/useStaff';
import { useStaffLeaves } from '../../hooks/useStaffLeaves';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, UserProfile, ROLE_HIERARCHY } from '../../types';
import StaffList from './StaffList';
import StaffForm from './StaffForm';
import StaffViewModal from './StaffViewModal';
import StaffSchedule from './StaffSchedule';
import LeaveManagement from './LeaveManagement';
import TeacherIdMigrationModal from '../Settings/TeacherIdMigrationModal';

type ViewMode = 'list' | 'schedule' | 'leave';

interface StaffManagerProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  currentUserProfile?: UserProfile | null;
}

const StaffManager: React.FC<StaffManagerProps> = ({
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  currentUserProfile,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffMember['role'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StaffMember['status'] | 'all'>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffMember | null>(null); // 조회 모달용
  const [showMigrationModal, setShowMigrationModal] = useState(false); // 마이그레이션 모달

  // Hooks
  const { staff, loading, error, refreshStaff, addStaff, updateStaff, deleteStaff } = useStaff();
  const { leaves, pendingCount } = useStaffLeaves();

  const isMaster = currentUserProfile?.role === 'master';
  const isAdmin = currentUserProfile?.role === 'admin';

  // Search handling (support both internal and external)
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const handleSearchChange = externalOnSearchChange ?? setInternalSearchQuery;

  // Filter staff
  const filteredStaff = useMemo(() => {
    let result = [...staff];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(s => s.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [staff, searchQuery, roleFilter, statusFilter]);

  // Stats - staff 기반으로 계산
  const stats = useMemo(() => {
    const pendingApprovals = staff.filter(s => s.uid && s.approvalStatus === 'pending').length;
    return {
      total: staff.length,
      active: staff.filter(s => s.status === 'active').length,
      teachers: staff.filter(s => s.role === 'teacher').length,
      pendingLeaves: pendingCount,
      pendingApprovals, // 가입대기 인원(staff 기반)
    };
  }, [staff, pendingCount]);

  // Handlers
  const handleAddNew = () => {
    setEditingStaff(null);
    setShowForm(true);
  };

  // 직원 클릭 시 조회 모달 열기
  const handleViewStaff = (staffMember: StaffMember) => {
    setViewingStaff(staffMember);
    setSelectedStaff(staffMember);
  };

  // 권한 체크: 대상 직원을 수정할 수 있는지 확인
  const canEditStaff = (targetStaff: StaffMember): boolean => {
    if (!currentUserProfile) return false;

    const currentRole = currentUserProfile.role;
    const targetRole = targetStaff.systemRole || 'user';

    // 자기 자신은 수정 가능
    if (currentUserProfile.uid === targetStaff.uid) return true;

    // ROLE_HIERARCHY에서 인덱스 확인 (낮은 인덱스 = 높은 권한)
    const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);

    // 자신보다 낮은 권한만 수정 가능 (같은 권한도 불가)
    return currentIndex < targetIndex;
  };

  // 권한 체크: 대상 직원을 삭제할 수 있는지 확인
  const canDeleteStaff = (targetStaff: StaffMember): boolean => {
    if (!currentUserProfile) return false;

    const currentRole = currentUserProfile.role;
    const targetRole = targetStaff.systemRole || 'user';

    // 자기 자신은 삭제 불가
    if (currentUserProfile.uid === targetStaff.uid) return false;

    // ROLE_HIERARCHY에서 인덱스 확인 (낮은 인덱스 = 높은 권한)
    const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);

    // 자신보다 낮은 권한만 삭제 가능 (같은 권한도 불가)
    return currentIndex < targetIndex;
  };

  // 조회 모달에서 수정 버튼 클릭 시
  const handleEditFromView = () => {
    if (viewingStaff) {
      // 권한 체크
      if (!canEditStaff(viewingStaff)) {
        alert('자신보다 높거나 같은 권한의 직원은 수정할 수 없습니다.\n(본인 계정은 수정 가능합니다)');
        return;
      }

      setEditingStaff(viewingStaff);
      setViewingStaff(null);
      setShowForm(true);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingStaff(null);
  };

  const handleFormSubmit = async (data: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, data, editingStaff);
      } else {
        await addStaff(data);
      }
      handleFormClose();
    } catch (err) {
      console.error('직원 저장 실패:', err);
      alert('저장에 실패했습니다.');
    }
  };

  // 직원 삭제 (StaffViewModal에서 confirm 처리됨)
  const handleDelete = async (id: string) => {
    try {
      await deleteStaff(id);
      setViewingStaff(null); // 조회 모달 닫기
      setSelectedStaff(null);
    } catch (err) {
      console.error('직원 삭제 실패:', err);
      throw err; // StaffViewModal에서 에러 처리
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header - Compact */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Title + Stats inline */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#fdb813]" />
              <h1 className="text-sm font-bold text-[#081429]">직원 관리</h1>
            </div>

            {/* Inline Stats */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">전체 <span className="font-bold text-[#081429]">{stats.total}</span></span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">재직 <span className="font-bold text-emerald-600">{stats.active}</span></span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">강사 <span className="font-bold text-blue-600">{stats.teachers}</span></span>
              {stats.pendingLeaves > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-amber-600 font-bold">휴가대기 {stats.pendingLeaves}</span>
                </>
              )}
              {stats.pendingApprovals > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    가입대기 {stats.pendingApprovals}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshStaff}
              className="p-1.5 text-gray-500 hover:text-[#081429] hover:bg-gray-100 rounded transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {isMaster && (
              <button
                onClick={() => setShowMigrationModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-700 transition-colors"
                title="Enrollment 데이터 마이그레이션 (완료됨)"
              >
                <Database className="w-3 h-3" />
                <span>DB 마이그레이션</span>
              </button>
            )}
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#081429] text-white rounded text-xs font-bold hover:bg-[#0a1a35] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>직원 추가</span>
            </button>
          </div>
        </div>

        {/* View Mode Tabs - Compact */}
        <div className="flex items-center gap-1 mt-1.5 border-t border-gray-100 pt-1.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
              viewMode === 'list'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>직원 목록</span>
          </button>
          <button
            onClick={() => setViewMode('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
              viewMode === 'schedule'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>근무 일정</span>
          </button>
          <button
            onClick={() => setViewMode('leave')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
              viewMode === 'leave'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>휴가 관리</span>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters (only for list view) */}
      {viewMode === 'list' && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="이름, 이메일, 전화번호 검색..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as StaffMember['role'] | 'all')}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
              >
                <option value="all">전체 직책</option>
                {Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StaffMember['status'] | 'all')}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
            >
              <option value="all">전체 상태</option>
              {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Count */}
            <div className="text-xs text-gray-500">
              {filteredStaff.length}명
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#081429]"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : (
          <>
            {viewMode === 'list' && (
              <StaffList
                staff={filteredStaff}
                selectedStaff={selectedStaff}
                onSelectStaff={handleViewStaff}
              />
            )}
            {viewMode === 'schedule' && (
              <StaffSchedule staff={staff.filter(s => s.status === 'active')} />
            )}
            {viewMode === 'leave' && (
              <LeaveManagement staff={staff} leaves={leaves} />
            )}
          </>
        )}
      </div>

      {/* Staff View Modal (조회) */}
      {viewingStaff && (
        <StaffViewModal
          staff={viewingStaff}
          onClose={() => setViewingStaff(null)}
          onEdit={handleEditFromView}
          onDelete={handleDelete}
          canEdit={canEditStaff(viewingStaff)}
          canDelete={canDeleteStaff(viewingStaff)}
          currentUserUid={currentUserProfile?.uid}
        />
      )}

      {/* Staff Form Modal (수정/등록) */}
      {showForm && (
        <StaffForm
          staff={editingStaff}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          showSystemFields={isMaster || isAdmin}
          currentUserRole={currentUserProfile?.role}
        />
      )}

      {/* TeacherId Migration Modal */}
      {showMigrationModal && (
        <TeacherIdMigrationModal onClose={() => setShowMigrationModal(false)} />
      )}

    </div>
  );
};

export default StaffManager;
