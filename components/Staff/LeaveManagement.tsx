import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Check,
  X,
  Clock,
  Plus,
  Filter,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import {
  StaffMember,
  StaffLeave,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
} from '../../types';
import { useStaffLeaves } from '../../hooks/useStaffLeaves';

interface LeaveManagementProps {
  staff: StaffMember[];
  leaves: StaffLeave[];
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ staff, leaves }) => {
  const [statusFilter, setStatusFilter] = useState<StaffLeave['status'] | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeave, setNewLeave] = useState({
    staffId: '',
    type: 'annual' as StaffLeave['type'],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const { addLeave, approveLeave, rejectLeave, isApproving, isRejecting } = useStaffLeaves();

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    let result = [...leaves];

    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }

    return result.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [leaves, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  }), [leaves]);

  const getStatusBadge = (status: StaffLeave['status']) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${styles[status]}`}>
        {LEAVE_STATUS_LABELS[status]}
      </span>
    );
  };

  const getTypeBadge = (type: StaffLeave['type']) => {
    const styles = {
      annual: 'bg-blue-100 text-blue-800',
      sick: 'bg-pink-100 text-pink-800',
      personal: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[type]}`}>
        {LEAVE_TYPE_LABELS[type]}
      </span>
    );
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleAddLeave = async () => {
    if (!newLeave.staffId) {
      alert('직원을 선택해주세요.');
      return;
    }

    const selectedStaff = staff.find(s => s.id === newLeave.staffId);
    if (!selectedStaff) return;

    try {
      await addLeave({
        ...newLeave,
        staffName: selectedStaff.name,
        status: 'pending',
      });
      setShowAddForm(false);
      setNewLeave({
        staffId: '',
        type: 'annual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: '',
      });
    } catch (error) {
      console.error('휴가 신청 실패:', error);
      alert('휴가 신청에 실패했습니다.');
    }
  };

  const handleApprove = async (leaveId: string) => {
    try {
      await approveLeave(leaveId);
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인에 실패했습니다.');
    }
  };

  const handleReject = async (leaveId: string) => {
    try {
      await rejectLeave(leaveId);
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-800 font-medium">승인 대기</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-800 font-medium">승인됨</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.approved}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <X className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800 font-medium">반려됨</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StaffLeave['status'] | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
          >
            <option value="all">전체 상태</option>
            {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>휴가 신청</span>
        </button>
      </div>

      {/* Add Leave Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-[#081429] mb-4">새 휴가 신청</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직원</label>
              <select
                value={newLeave.staffId}
                onChange={(e) => setNewLeave(prev => ({ ...prev, staffId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
              >
                <option value="">선택하세요</option>
                {staff.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">휴가 유형</label>
              <select
                value={newLeave.type}
                onChange={(e) => setNewLeave(prev => ({ ...prev, type: e.target.value as StaffLeave['type'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
              >
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={newLeave.startDate}
                onChange={(e) => setNewLeave(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={newLeave.endDate}
                onChange={(e) => setNewLeave(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">사유</label>
              <input
                type="text"
                value={newLeave.reason}
                onChange={(e) => setNewLeave(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="휴가 사유를 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleAddLeave}
              className="px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] transition-colors"
            >
              신청
            </button>
          </div>
        </div>
      )}

      {/* Leave List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">휴가 신청 내역이 없습니다</p>
            <p className="text-sm">상단의 '휴가 신청' 버튼을 클릭하여 휴가를 신청하세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLeaves.map((leave) => (
              <div key={leave.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-[#081429]">{leave.staffName}</span>
                      {getTypeBadge(leave.type)}
                      {getStatusBadge(leave.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {leave.startDate} ~ {leave.endDate}
                      </span>
                      <span className="text-[#fdb813] font-medium">
                        ({calculateDays(leave.startDate, leave.endDate)}일)
                      </span>
                    </div>
                    {leave.reason && (
                      <p className="text-sm text-gray-500 mt-1">
                        사유: {leave.reason}
                      </p>
                    )}
                  </div>

                  {/* Actions for pending leaves */}
                  {leave.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(leave.id)}
                        disabled={isApproving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>승인</span>
                      </button>
                      <button
                        onClick={() => handleReject(leave.id)}
                        disabled={isRejecting}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>반려</span>
                      </button>
                    </div>
                  )}

                  {/* Approval info */}
                  {leave.status !== 'pending' && leave.approvedBy && (
                    <div className="text-xs text-gray-500 text-right">
                      <div>{leave.approvedBy}</div>
                      <div>{leave.approvedAt}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;
