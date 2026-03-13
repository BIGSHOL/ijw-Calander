import React, { useState } from 'react';
import { Search, FileText, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useConsultationReports } from '../../hooks/useConsultationRecording';
import { format } from 'date-fns';
import type { ConsultationReportStatus } from '../../types';

interface ReportHistoryListProps {
  onSelectReport: (reportId: string) => void;
}

const STATUS_MAP: Record<ConsultationReportStatus, { label: string; color: string }> = {
  uploading: { label: '업로드 중', color: 'bg-blue-100 text-blue-700' },
  transcribing: { label: '음성 인식 중', color: 'bg-yellow-100 text-yellow-700' },
  analyzing: { label: 'AI 분석 중', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  error: { label: '오류', color: 'bg-red-100 text-red-700' },
};

export function ReportHistoryList({ onSelectReport }: ReportHistoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: reports = [], isLoading } = useConsultationReports();

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
            return (
              <button
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                {/* 상태 아이콘 */}
                <div className="flex-shrink-0">
                  {report.status === 'completed' ? (
                    <FileText size={20} className="text-green-500" />
                  ) : report.status === 'error' ? (
                    <AlertCircle size={20} className="text-red-500" />
                  ) : (
                    <Loader2 size={20} className="text-accent-500 animate-spin" />
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{report.studentName}</span>
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

                {/* 생성일 */}
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {format(new Date(report.createdAt), 'MM/dd HH:mm')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
