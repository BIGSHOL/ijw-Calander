import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, RefreshCw, Calendar, Briefcase, AlertCircle } from 'lucide-react';
import { useStaff } from '../../hooks/useStaff';
import { useStaffLeaves } from '../../hooks/useStaffLeaves';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, UserProfile } from '../../types';
import StaffList from './StaffList';
import StaffForm from './StaffForm';
import StaffViewModal from './StaffViewModal';
import StaffSchedule from './StaffSchedule';
import LeaveManagement from './LeaveManagement';

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
      pendingApprovals, // 가입 승인 대기 (staff 기반)
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

  // 조회 모달에서 수정 버튼 클릭 시
  const handleEditFromView = () => {
    if (viewingStaff) {
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#081429] rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#fdb813]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#081429]">직원 관리</h1>
              <p className="text-sm text-gray-500">Staff Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshStaff}
              className="p-2 text-gray-500 hover:text-[#081429] hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>직원 추가</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-[#081429]">{stats.total}</div>
            <div className="text-xs text-gray-500">전체 직원</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            <div className="text-xs text-gray-500">재직중</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{stats.teachers}</div>
            <div className="text-xs text-gray-500">강사</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-600">{stats.pendingLeaves}</div>
            <div className="text-xs text-gray-500">휴가 승인 대기</div>
          </div>
          <div className={`rounded-lg p-3 ${stats.pendingApprovals > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className={`text-2xl font-bold ${stats.pendingApprovals > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.pendingApprovals}</div>
            <div className="text-xs text-gray-500">가입 승인 대기</div>
          </div>
        </div>

        {/* 승인 대기 알림 */}
        {stats.pendingApprovals > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-bold text-red-900">{stats.pendingApprovals}명의 가입 승인 대기</span>
              <span className="text-xs text-red-700 ml-2">직원을 클릭하여 시스템 권한을 설정해주세요.</span>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex items-center gap-4 border-b border-gray-200">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              viewMode === 'list'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>직원 목록</span>
          </button>
          <button
            onClick={() => setViewMode('schedule')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              viewMode === 'schedule'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>근무 일정</span>
          </button>
          <button
            onClick={() => setViewMode('leave')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              viewMode === 'leave'
                ? 'border-[#fdb813] text-[#081429] font-semibold'
                : 'border-transparent text-gray-500 hover:text-[#081429]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>휴가 관리</span>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters (only for list view) */}
      {viewMode === 'list' && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="이름, 이메일, 전화번호 검색..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as StaffMember['role'] | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
            >
              <option value="all">전체 상태</option>
              {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Count */}
            <div className="text-sm text-gray-500">
              {filteredStaff.length}명
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
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
          canEdit={isMaster || isAdmin}
          canDelete={isMaster || isAdmin}
        />
      )}

      {/* Staff Form Modal (수정/등록) */}
      {showForm && (
        <StaffForm
          staff={editingStaff}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          showSystemFields={isMaster || isAdmin}
        />
      )}

    </div>
  );
};

export default StaffManager;
