import React, { useState } from 'react';
import { Search, FileText, Clock, AlertCircle, Loader2, Trash2, Pencil, Check, X, RefreshCw, Users, UserCheck } from 'lucide-react';
import { useMeetingReports, useDeleteMeetingReport, useUpdateMeetingReportTitle, useReanalyzeMeetingReport, useRetryMeetingProcessing } from '../../hooks/useMeetingRecording';
import { usePermissions } from '../../hooks/usePermissions';
import { format } from 'date-fns';
import type { MeetingReportStatus, UserProfile } from '../../types';

interface MeetingHistoryListProps {
  onSelectReport: (reportId: string) => void;
  userProfile: UserProfile | null;
}

const STATUS_MAP: Record<MeetingReportStatus, { label: string; color: string }> = {
  uploading: { label: '업로드 중', color: 'bg-blue-100 text-blue-700' },
  transcribing: { label: '음성 인식 중', color: 'bg-yellow-100 text-yellow-700' },
  analyzing: { label: 'AI 분석 중', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  failed: { label: '분석 불가', color: 'bg-amber-100 text-amber-700' },
  error: { label: '오류', color: 'bg-red-100 text-red-700' },
};

export function MeetingHistoryList({ onSelectReport, userProfile }: MeetingHistoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: reports = [], isLoading } = useMeetingReports();
  const { hasPermission } = usePermissions(userProfile);
  const deleteMutation = useDeleteMeetingReport();
  const renameMutation = useUpdateMeetingReportTitle();
  const reanalyzeMutation = useReanalyzeMeetingReport();
  const retryMutation = useRetryMeetingProcessing();
  const canDelete = hasPermission('recording.delete');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleDelete = (e: React.MouseEvent, report: { id: string; storagePath?: string; title?: string }) => {
    e.stopPropagation();
    if (!window.confirm(`"${report.title}" 회의록을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    deleteMutation.mutate({ id: report.id, storagePath: report.storagePath || '' });
  };

  const handleReanalyze = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!window.confirm('새 알고리즘으로 재분석하시겠습니까?\n기존 분석 결과가 덮어씌워집니다.')) return;
    reanalyzeMutation.mutate(reportId);
  };

  const handleRetry = (e: React.MouseEvent, report: any) => {
    e.stopPropagation();
    if (!window.confirm('음성 인식부터 다시 처리하시겠습니까?')) return;
    retryMutation.mutate({
      id: report.id,
      storagePath: report.storagePath || '',
      title: report.title || '',
      attendees: report.attendees || [],
      meetingDate: report.meetingDate || '',
      recorder: report.recorder || '',
      fileName: report.fileName || '',
    });
  };

  const handleStartEdit = (e: React.MouseEvent, report: { id: string; title: string }) => {
    e.stopPropagation();
    setEditingId(report.id);
    setEditTitle(report.title);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editTitle.trim()) return;
    renameMutation.mutate({ id: editingId, title: editTitle.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const filtered = searchQuery.trim()
    ? reports.filter(r =>
        r.title?.includes(searchQuery) ||
        r.attendees?.some(a => a.includes(searchQuery)) ||
        r.meetingDate?.includes(searchQuery)
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
            placeholder="제목, 참석자 또는 날짜 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
        <span className="text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">회의록 내역이 없습니다.</p>
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
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(e as unknown as React.MouseEvent);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="text-sm font-medium text-gray-900 border rounded-sm px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent-400 w-48"
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
                        <span className="text-sm font-medium text-gray-900 truncate">{report.title}</span>
                        <button
                          onClick={(e) => handleStartEdit(e, report)}
                          className="p-0.5 text-gray-300 hover:text-accent-500 rounded"
                          title="제목 수정"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {(report as any).fileExpired && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        파일 만료
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{report.meetingDate}</span>
                    {report.attendees?.length > 0 && (
                      <span
                        className="flex items-center gap-0.5 truncate max-w-[200px]"
                        title={
                          report.attendeesReconciled && report.originalAttendees
                            ? `조정됨 (원본: ${report.originalAttendees.join(', ')})`
                            : report.attendees.join(', ')
                        }
                      >
                        {report.attendeesReconciled ? <UserCheck size={10} className="flex-shrink-0 text-blue-500" /> : <Users size={10} className="flex-shrink-0" />}
                        {' '}{report.attendees.join(', ')}
                      </span>
                    )}
                    {report.durationSeconds != null && report.durationSeconds > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} /> {Math.floor(report.durationSeconds / 60)}분
                      </span>
                    )}
                    {report.statusMessage && report.status === 'analyzing' && (
                      <span className="text-purple-500">{report.statusMessage}</span>
                    )}
                  </div>
                </div>

                {/* 재분석 / 재처리 (파일 만료 시 숨김) */}
                {!(report as any).fileExpired && (report.status === 'completed' || report.status === 'failed') && (() => {
                  const isReanalyzing = reanalyzeMutation.isPending && reanalyzeMutation.variables === report.id;
                  return (
                    <button
                      onClick={(e) => handleReanalyze(e, report.id)}
                      disabled={isReanalyzing}
                      className="flex-shrink-0 p-1.5 text-gray-300 hover:text-accent-500 hover:bg-accent-50 rounded transition-colors"
                      title="재분석"
                    >
                      {isReanalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                  );
                })()}
                {!(report as any).fileExpired && (report.status === 'uploading' || report.status === 'transcribing' || report.status === 'error') && (() => {
                  const isRetrying = retryMutation.isPending && retryMutation.variables?.id === report.id;
                  return (
                    <button
                      onClick={(e) => handleRetry(e, report)}
                      disabled={isRetrying}
                      className="flex-shrink-0 p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                      title="다시 처리"
                    >
                      {isRetrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                  );
                })()}

                {/* 삭제 */}
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, report)}
                    disabled={isDeleting}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="삭제"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
