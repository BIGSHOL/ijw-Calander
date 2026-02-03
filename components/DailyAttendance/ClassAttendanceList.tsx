// components/DailyAttendance/ClassAttendanceList.tsx
// Component for displaying and managing attendance records by class
import React, { useState, useMemo } from 'react';
import {
  Check,
  Clock,
  X,
  LogOut,
  FileText,
  MoreVertical,
  Search,
  Loader2,
  Users
} from 'lucide-react';
import {
  DailyAttendanceRecord,
  AttendanceStatus,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  UserProfile
} from '../../types';
import { useUpdateDailyAttendanceStatus } from '../../hooks/useDailyAttendance';
import { useUpdateAttendance } from '../../hooks/useAttendance';
import { useBatchAttendanceUpdate } from '../../hooks/useBatchAttendanceUpdate';
import { mapAttendanceStatusToValue } from '../../utils/attendanceSync';

interface ClassAttendanceListProps {
  records: DailyAttendanceRecord[];
  selectedDate: string;
  isLoading: boolean;
  userProfile: UserProfile | null;
  onRefresh: () => void;
}

// Status button configurations
const STATUS_BUTTONS: Array<{
  status: AttendanceStatus;
  icon: typeof Check;
  label: string;
  activeClass: string;
}> = [
  { status: 'present', icon: Check, label: '출석', activeClass: 'bg-emerald-500 text-white' },
  { status: 'late', icon: Clock, label: '지각', activeClass: 'bg-amber-500 text-white' },
  { status: 'absent', icon: X, label: '결석', activeClass: 'bg-red-500 text-white' },
  { status: 'early_leave', icon: LogOut, label: '조퇴', activeClass: 'bg-orange-500 text-white' },
  { status: 'excused', icon: FileText, label: '사유', activeClass: 'bg-blue-500 text-white' },
];

const ClassAttendanceList: React.FC<ClassAttendanceListProps> = ({
  records,
  selectedDate,
  isLoading,
  userProfile,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [updatingRecordIds, setUpdatingRecordIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Mutations for updating status
  const batchUpdateMutation = useBatchAttendanceUpdate();
  const updateStatusMutation = useUpdateDailyAttendanceStatus();
  const updateAttendanceMutation = useUpdateAttendance();

  // Group records by class
  const recordsByClass = useMemo(() => {
    const grouped = new Map<string, DailyAttendanceRecord[]>();

    records.forEach(record => {
      const key = record.classId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    });

    // Sort students within each class
    grouped.forEach((classRecords) => {
      classRecords.sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko'));
    });

    return grouped;
  }, [records]);

  // Filter by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter(
      record =>
        record.studentName.toLowerCase().includes(query) ||
        record.className.toLowerCase().includes(query)
    );
  }, [records, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Handle status change with duplicate request prevention and atomic batch update
  const handleStatusChange = async (recordId: string, status: AttendanceStatus) => {
    if (!userProfile) return;

    // 중복 요청 방지: 이미 처리 중인 레코드면 무시
    if (updatingRecordIds.has(recordId)) {
      console.warn('Already updating this record, ignoring duplicate request');
      return;
    }

    const record = records.find(r => r.id === recordId);
    if (!record) return;

    // 처리 중 상태로 마킹
    setUpdatingRecordIds(prev => new Set(prev).add(recordId));

    try {
      // Firestore Batch Write를 사용하여 원자적으로 양쪽 업데이트
      await batchUpdateMutation.mutateAsync({
        date: selectedDate,
        recordId,
        status,
        updatedBy: userProfile.uid,
        studentId: record.studentId,
        studentName: record.studentName,
        classId: record.classId,
        className: record.className,
        yearMonth: selectedDate.substring(0, 7),
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('출결 상태 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      // 처리 완료: 마킹 제거
      setUpdatingRecordIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  // Handle note save
  const handleNoteSave = async (recordId: string) => {
    if (!userProfile) return;

    try {
      await updateStatusMutation.mutateAsync({
        date: selectedDate,
        recordId,
        status: records.find(r => r.id === recordId)?.status || 'present',
        note: noteValue,
        updatedBy: userProfile.uid,
      });
      setEditingNoteId(null);
      setNoteValue('');
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Users className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">출결 기록이 없습니다</p>
        <p className="text-sm mt-1">선택한 날짜에 등록된 출결 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="학생 또는 수업 검색..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Records List */}
      <div className="rounded-sm shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: '#08142915' }}>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>
                학생
              </th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>
                수업
              </th>
              <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: '#373d41' }}>
                출결 상태
              </th>
              <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: '#373d41' }}>
                입실/퇴실
              </th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>
                메모
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRecords.map((record, idx) => {
              const statusColor = ATTENDANCE_STATUS_COLORS[record.status];

              return (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors" style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  {/* Student Name */}
                  <td className="px-2 py-1.5 text-xs">
                    <span className="font-medium text-gray-900">{record.studentName}</span>
                  </td>

                  {/* Class Name */}
                  <td className="px-2 py-1.5 text-xs">
                    <span className="text-sm text-gray-600">{record.className}</span>
                  </td>

                  {/* Status Buttons */}
                  <td className="px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-center gap-1">
                      {STATUS_BUTTONS.map(({ status, icon: Icon, label, activeClass }) => {
                        const isUpdating = updatingRecordIds.has(record.id);
                        return (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(record.id, status)}
                            disabled={isUpdating}
                            className={`p-1.5 rounded-sm transition-all ${
                              record.status === status
                                ? activeClass
                                : isUpdating
                                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={isUpdating ? '처리 중...' : label}
                          >
                            <Icon className={`w-4 h-4 ${isUpdating ? 'animate-pulse' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* Check-in/Check-out Time */}
                  <td className="px-2 py-1.5 text-xs text-center">
                    <div className="text-sm text-gray-600">
                      {record.checkInTime && (
                        <span className="text-emerald-600">{record.checkInTime}</span>
                      )}
                      {record.checkInTime && record.checkOutTime && ' - '}
                      {record.checkOutTime && (
                        <span className="text-orange-600">{record.checkOutTime}</span>
                      )}
                      {!record.checkInTime && !record.checkOutTime && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>

                  {/* Note */}
                  <td className="px-2 py-1.5 text-xs">
                    {editingNoteId === record.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNoteSave(record.id);
                            if (e.key === 'Escape') {
                              setEditingNoteId(null);
                              setNoteValue('');
                            }
                          }}
                        />
                        <button
                          onClick={() => handleNoteSave(record.id)}
                          className="px-2 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingNoteId(record.id);
                          setNoteValue(record.note || '');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {record.note || '메모 추가...'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredRecords.length > 0 && (
        <div className="p-3 rounded-sm shadow-sm border flex items-center justify-between" style={{ backgroundColor: 'white', borderColor: '#08142915' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#373d41' }}>페이지당</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 text-xs rounded-sm border transition-all"
              style={{ borderColor: '#08142920', color: '#081429', backgroundColor: 'white' }}
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <span className="text-xs hidden sm:inline" style={{ color: '#373d41' }}>
              {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRecords.length)} / 총 {filteredRecords.length}개
            </span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              style={{ color: '#081429' }}
            >이전</button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (safePage <= 3) pageNum = i + 1;
                else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = safePage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                    className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${safePage === pageNum ? 'text-[#081429]' : 'text-gray-600 hover:bg-gray-100'}`}
                    style={{ backgroundColor: safePage === pageNum ? '#fdb813' : 'transparent' }}
                  >{pageNum}</button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              style={{ color: '#081429' }}
            >다음</button>
          </nav>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-4">
        {STATUS_BUTTONS.map(({ status, icon: Icon, label }) => {
          const color = ATTENDANCE_STATUS_COLORS[status];
          return (
            <div key={status} className="flex items-center gap-1">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${color.bg} ${color.text}`}>
                <Icon className="w-3 h-3" />
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassAttendanceList;
