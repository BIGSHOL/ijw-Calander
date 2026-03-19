import React, { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, Clock, User, Calendar, RefreshCw, Loader2, Pencil, Check, X, AlertCircle } from 'lucide-react';
import type { ConsultationReport, UserProfile } from '../../types';
import { useReanalyzeReport, useUpdateConsultationReportContent } from '../../hooks/useConsultationRecording';
import { format } from 'date-fns';

interface ReportViewerProps {
  report: ConsultationReport;
  canEdit?: boolean;
  currentUser?: UserProfile | null;
}

const SECTIONS = [
  { key: 'consultationType' as const, label: '상담 성격', emoji: '🏷️' },
  { key: 'summary' as const, label: '상담 요약', emoji: '📋' },
  { key: 'familyContext' as const, label: '가정 배경/개인 맥락', emoji: '👨‍👩‍👧' },
  { key: 'parentConcerns' as const, label: '학부모 걱정/불안 사항', emoji: '😟' },
  { key: 'parentQuestions' as const, label: '학부모 질문사항', emoji: '❓' },
  { key: 'parentRequests' as const, label: '학부모 요청사항', emoji: '🙋' },
  { key: 'parentSatisfaction' as const, label: '학부모 만족도/감정 분석', emoji: '💭' },
  { key: 'studentNotes' as const, label: '학생 관련 특이사항', emoji: '📝' },
  { key: 'teacherResponse' as const, label: '교사 대응/설명 요약', emoji: '🧑‍🏫' },
  { key: 'salesPoints' as const, label: '상담사 세일즈 포인트', emoji: '💼' },
  { key: 'agreements' as const, label: '합의된 사항', emoji: '🤝' },
  { key: 'actionItems' as const, label: '후속 조치 항목', emoji: '✅' },
  { key: 'riskFlags' as const, label: '주의 필요 신호', emoji: '🚨' },
];

import { formatReportContent } from '../../utils/formatReportContent';
import { HighlightedReportText } from '../../utils/HighlightedReportText';
import { ConversationFlowTree } from './ConversationFlowTree';

export function ReportViewer({ report, canEdit, currentUser }: ReportViewerProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const reanalyzeMutation = useReanalyzeReport();
  const updateContentMutation = useUpdateConsultationReportContent();

  // 편집 상태: { sectionKey: editingText }
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

  // TXT 다운로드
  const handleDownload = () => {
    const lines: string[] = [
      `상담 녹음 분석 보고서`,
      `${'='.repeat(40)}`,
      `학생: ${report.studentName}`,
      `상담일: ${report.consultationDate}`,
      `상담자: ${report.consultantName || '미지정'}`,
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
      if (report.speakerLabels && report.speakerLabels.length > 0) {
        if (report.speakerRoles && Object.keys(report.speakerRoles).length > 0) {
          lines.push(`[화자 식별] ${Object.entries(report.speakerRoles).map(([k, v]) => `화자 ${k} = ${v}`).join(', ')}`);
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
    a.download = `상담분석_${report.studentName}_${report.consultationDate}.txt`;
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
            분석 완료
          </h2>
          <div className="flex items-center gap-4 mt-1 text-xs text-green-600">
            <span className="flex items-center gap-1">
              <User size={12} /> {report.studentName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {report.consultationDate}
            </span>
            {report.durationSeconds && (
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
              {reanalyzeMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
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
            <p className="text-xs text-purple-600 mt-0.5">AI가 보고서를 다시 작성하고 있습니다. 완료까지 1~3분 소요됩니다.</p>
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
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"><HighlightedReportText content={content} /></p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 상담 흐름 수형도 */}
        {report.report?.conversationFlow && report.report.conversationFlow.length > 0 && (
          <div className="border rounded-sm">
            <button
              onClick={() => toggleSection('_conversationFlow')}
              className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-800">
                🌳 상담 흐름 수형도
              </h3>
              {expandedSections.has('_conversationFlow') ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {expandedSections.has('_conversationFlow') && (
              <div className="px-4 py-3 border-t">
                <ConversationFlowTree flow={report.report.conversationFlow} />
              </div>
            )}
          </div>
        )}

        {/* 원본 음성인식 텍스트 (접기/펼치기) */}
        {report.transcription && (
          <div className="border rounded-sm">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-600">
                🎤 원본 음성인식 텍스트
              </h3>
              {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showTranscript && (
              <div className="px-4 py-3 max-h-80 overflow-auto">
                {report.speakerLabels && report.speakerLabels.length > 0 ? (
                  <div className="space-y-2">
                    {/* 화자 역할 범례 */}
                    {report.speakerRoles && Object.keys(report.speakerRoles).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b">
                        {Object.entries(report.speakerRoles).map(([key, role]) => (
                          <span key={key} className="px-2 py-0.5 text-xs rounded-full bg-accent-50 text-accent-700 font-medium">
                            화자 {key} = {role}
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
