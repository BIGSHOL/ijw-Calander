import React, { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, Clock, Users, Calendar, RefreshCw, Loader2, Pencil, Check, X, AlertCircle } from 'lucide-react';
import type { MeetingReport, UserProfile } from '../../types';
import { useReanalyzeMeetingReport } from '../../hooks/useMeetingRecording';
import { useUpdateConsultationReportContent } from '../../hooks/useConsultationRecording';
import { format } from 'date-fns';
import { formatReportContent } from '../../utils/formatReportContent';

interface MeetingReportViewerProps {
  report: MeetingReport;
  canEdit?: boolean;
  currentUser?: UserProfile | null;
}

const SECTIONS = [
  { key: 'meetingType' as const, label: '회의 유형', emoji: '🏷️' },
  { key: 'summary' as const, label: '회의 요약', emoji: '📋' },
  { key: 'agendaDiscussion' as const, label: '안건별 논의 내용', emoji: '📝' },
  { key: 'decisions' as const, label: '결정 사항', emoji: '✅' },
  { key: 'actionItems' as const, label: '액션 아이템', emoji: '🎯' },
  { key: 'speakerSummary' as const, label: '참석자별 발언 요약', emoji: '🗣️' },
  { key: 'concerns' as const, label: '우려/이슈 사항', emoji: '⚠️' },
  { key: 'nextSteps' as const, label: '향후 계획', emoji: '🔮' },
];

export function MeetingReportViewer({ report, canEdit, currentUser }: MeetingReportViewerProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const reanalyzeMutation = useReanalyzeMeetingReport();
  const updateContentMutation = useUpdateConsultationReportContent('meeting_reports');

  // 편집 상태
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const startEditing = (sectionKey: string, currentContent: string) => {
    setEditingSection(sectionKey);
    setEditingText(currentContent);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditingText('');
  };

  const saveEditing = () => {
    if (!editingSection || !currentUser) return;
    updateContentMutation.mutate({
      reportId: report.id,
      sectionKey: editingSection,
      content: editingText,
      editedBy: currentUser.uid || '',
      editedByName: currentUser.displayName || currentUser.name || '',
    }, {
      onSuccess: () => {
        setEditingSection(null);
        setEditingText('');
      },
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllSections = () => {
    const availableKeys = SECTIONS.filter(s => report.report?.[s.key]).map(s => s.key);
    if (expandedSections.size >= availableKeys.length) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(availableKeys));
    }
  };

  const handleReanalyze = () => {
    if (!window.confirm('새 알고리즘으로 재분석하시겠습니까?\n기존 분석 결과가 덮어씌워집니다.')) return;
    reanalyzeMutation.mutate(report.id);
  };

  const handleDownload = () => {
    const lines: string[] = [
      `회의록`,
      `${'='.repeat(40)}`,
      `제목: ${report.title}`,
      `회의일: ${report.meetingDate}`,
      `참석자: ${(report.attendees || []).join(', ') || '미지정'}`,
      report.recorder ? `기록자: ${report.recorder}` : '',
      report.durationSeconds ? `녹음 길이: ${Math.floor(report.durationSeconds / 60)}분 ${report.durationSeconds % 60}초` : '',
      `생성일: ${format(new Date(report.createdAt), 'yyyy-MM-dd HH:mm')}`,
      '',
    ];

    if (report.report) {
      for (const section of SECTIONS) {
        const content = report.report[section.key];
        if (content) {
          lines.push(`[${section.label}]`);
          lines.push(formatReportContent(content));
          lines.push('');
        }
      }
    }

    if (report.transcription) {
      lines.push(`${'='.repeat(40)}`);
      lines.push('[원본 음성인식 텍스트]');
      lines.push('');
      if (report.speakerLabels?.length) {
        if (report.speakerRoles && Object.keys(report.speakerRoles).length > 0) {
          lines.push(`[참석자] ${Object.values(report.speakerRoles).join(', ')}`);
          lines.push('');
        }
        report.speakerLabels.forEach(s => {
          const role = report.speakerRoles?.[s.speaker];
          lines.push(`[${role || `화자 ${s.speaker}`}] ${s.text}`);
        });
      } else {
        lines.push(report.transcription);
      }
    }

    const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `회의록_${report.title}_${report.meetingDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-sm border shadow-sm">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b bg-green-50 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
            <FileText size={18} />
            회의록 완료
          </h2>
          <div className="flex items-center gap-4 mt-1 text-xs text-green-600">
            <span className="font-medium">{report.title}</span>
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {report.meetingDate}
            </span>
            {report.attendees?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {report.attendees.length}명
              </span>
            )}
            {report.durationSeconds != null && report.durationSeconds > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {Math.floor(report.durationSeconds / 60)}분 {report.durationSeconds % 60}초
              </span>
            )}
          </div>
          {report.lastEditedAt && (
            <div className="text-[10px] text-green-500 mt-0.5">
              마지막 수정: {format(new Date(report.lastEditedAt), 'yyyy-MM-dd HH:mm')} (KST) · {report.lastEditedByName || '알 수 없음'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!report.fileExpired && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzeMutation.isPending}
              className="px-3 py-2 text-sm bg-white border border-accent-300 text-accent-700 rounded-sm hover:bg-accent-50 flex items-center gap-1.5 disabled:opacity-50"
              title="새 알고리즘으로 재분석"
            >
              {reanalyzeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              재분석
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-3 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-sm hover:bg-green-50 flex items-center gap-1.5"
          >
            <Download size={14} />
            TXT 다운로드
          </button>
        </div>
      </div>

      {/* 파일 만료 안내 배너 */}
      {report.fileExpired && (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>원본 녹음 파일이 보관 기간(120일) 경과로 자동 삭제되었습니다. 분석 보고서는 계속 열람할 수 있습니다.</span>
          {report.fileExpiredAt && (
            <span className="ml-auto text-gray-400 flex-shrink-0">
              {format(new Date(report.fileExpiredAt), 'yyyy-MM-dd')} 삭제
            </span>
          )}
        </div>
      )}

      {/* 재분석 진행 중 배너 */}
      {reanalyzeMutation.isPending && (
        <div className="mx-5 mt-4 px-4 py-3 bg-purple-50 border border-purple-200 rounded-sm flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-purple-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-800">새 알고리즘으로 재분석 중...</p>
            <p className="text-xs text-purple-600 mt-0.5">AI가 회의록을 다시 작성하고 있습니다. 완료까지 1~3분 소요됩니다.</p>
          </div>
        </div>
      )}

      {/* 보고서 섹션 */}
      <div className="p-5 space-y-1">
        {report.report && (
          <div className="flex justify-end mb-2">
            <button
              onClick={toggleAllSections}
              className="text-xs text-gray-400 hover:text-accent-600 transition-colors"
            >
              {expandedSections.size >= SECTIONS.filter(s => report.report?.[s.key]).length ? '모두 접기' : '모두 펼치기'}
            </button>
          </div>
        )}
        {report.report && SECTIONS.map(section => {
          const content = report.report?.[section.key];
          if (!content) return null;
          const isExpanded = expandedSections.has(section.key);
          const isEditing = editingSection === section.key;

          return (
            <div key={section.key} className="border rounded-sm">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-sm font-semibold text-gray-800">
                  {section.emoji} {section.label}
                </h3>
                <div className="flex items-center gap-1">
                  {canEdit && isExpanded && !isEditing && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); startEditing(section.key, content as string); }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="수정"
                    >
                      <Pencil size={13} />
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 py-3 border-t">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        spellCheck={false}
                        className="w-full min-h-[120px] p-3 text-sm text-gray-700 border rounded-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-sm flex items-center gap-1"
                        >
                          <X size={12} /> 취소
                        </button>
                        <button
                          onClick={saveEditing}
                          disabled={updateContentMutation.isPending || editingText === content}
                          className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-sm flex items-center gap-1 disabled:opacity-50"
                        >
                          {updateContentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{formatReportContent(content)}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 원본 음성인식 텍스트 */}
        {report.transcription && (
          <div className="border rounded-sm">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-600">🎤 원본 음성인식 텍스트</h3>
              {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showTranscript && (
              <div className="px-4 py-3 max-h-80 overflow-auto">
                {report.speakerLabels?.length ? (
                  <div className="space-y-2">
                    {report.speakerRoles && Object.keys(report.speakerRoles).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b">
                        {Object.entries(report.speakerRoles).map(([key, role]) => (
                          <span key={key} className="px-2 py-0.5 text-xs rounded-full bg-accent-50 text-accent-700 font-medium">
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                    {report.speakerLabels.map((s, i) => {
                      const role = report.speakerRoles?.[s.speaker];
                      return (
                        <div key={i} className="text-sm">
                          <span className="font-medium text-accent-600">[{role || `화자 ${s.speaker}`}]</span>{' '}
                          <span className="text-gray-700">{s.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.transcription}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
