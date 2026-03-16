import React, { useState } from 'react';
import { Search, FileText, Clock, AlertCircle, Loader2, Trash2, Pencil, Check, X } from 'lucide-react';
import { useConsultationReports, useDeleteConsultationReport, useUpdateConsultationReportName } from '../../hooks/useConsultationRecording';
import { usePermissions } from '../../hooks/usePermissions';
import { format } from 'date-fns';
import type { ConsultationReportStatus, UserProfile } from '../../types';

interface ReportHistoryListProps {
  onSelectReport: (reportId: string) => void;
  userProfile: UserProfile | null;
}

const STATUS_MAP: Record<ConsultationReportStatus, { label: string; color: string }> = {
  uploading: { label: '업로드 중', color: 'bg-blue-100 text-blue-700' },
  transcribing: { label: '음성 인식 중', color: 'bg-yellow-100 text-yellow-700' },
  analyzing: { label: 'AI 분석 중', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  failed: { label: '분석 불가', color: 'bg-amber-100 text-amber-700' },
  error: { label: '오류', color: 'bg-red-100 text-red-700' },
};

export function ReportHistoryList({ onSelectReport, userProfile }: ReportHistoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: reports = [], isLoading } = useConsultationReports();
  const { hasPermission } = usePermissions(userProfile);
  const deleteMutation = useDeleteConsultationReport();
  const renameMutation = useUpdateConsultationReportName();
  const canDelete = hasPermission('recording.delete');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleDelete = (e: React.MouseEvent, report: { id: string; storagePath?: string; studentName?: string }) => {
    e.stopPropagation();
    if (!window.confirm(`"${report.studentName}" 녹음 분석 내역을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    deleteMutation.mutate({ id: report.id, storagePath: report.storagePath || '' });
  };

  const handleStartEdit = (e: React.MouseEvent, report: { id: string; studentName: string }) => {
    e.stopPropagation();
    setEditingId(report.id);
    setEditName(report.studentName);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editName.trim()) return;
    renameMutation.mutate({ id: editingId, studentName: editName.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const filtered = searchQuery.trim()
    ? reports.filter(r =>
        r.studentName?.includes(searchQuery) ||
        r.consultantName?.includes(searchQuery) ||
        r.consultationDate?.includes(searchQuery)
      )
    : reports;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm border shadow-sm">
      {/* 검색 */}
      <div className="px-5 py-3 border-b flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생명 또는 날짜 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <span className="text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">분석 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y max-h-[600px] overflow-auto">
          {filtered.map(report => {
            const statusInfo = STATUS_MAP[report.status] || STATUS_MAP.error;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables?.id === report.id;
            return (
              <div
                key={report.id}
                onClick={() => !isDeleting && onSelectReport(report.id)}
                className={`w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left cursor-pointer ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* 상태 아이콘 */}
                <div className="flex-shrink-0">
                  {report.status === 'completed' ? (
                    <FileText size={20} className="text-green-500" />
                  ) : report.status === 'error' || report.status === 'failed' ? (
                    <AlertCircle size={20} className={report.status === 'failed' ? 'text-amber-500' : 'text-red-500'} />
                  ) : (
                    <Loader2 size={20} className="text-accent-500 animate-spin" />
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {editingId === report.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(e as unknown as React.MouseEvent);
                            if (e.key === 'Escape') { setEditingId(null); }
                          }}
                          className="text-sm font-medium text-gray-900 border rounded-sm px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent-400 w-32"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="p-0.5 text-green-500 hover:bg-green-50 rounded" title="저장">
                          <Check size={14} />
                        </button>
                        <button onClick={handleCancelEdit} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded" title="취소">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-gray-900">{report.studentName}</span>
                        <button
                          onClick={(e) => handleStartEdit(e, report)}
                          className="p-0.5 text-gray-300 hover:text-accent-500 rounded"
                          title="이름 수정"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{report.consultationDate}</span>
                    {report.consultantName && <span>상담자: {report.consultantName}</span>}
                    {report.durationSeconds && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {Math.floor(report.durationSeconds / 60)}분
                      </span>
                    )}
                  </div>
                </div>

                {/* 삭제 버튼 */}
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, report)}
                    disabled={isDeleting}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="삭제"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}

                {/* 생성일 */}
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {format(new Date(report.createdAt), 'MM/dd HH:mm')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
