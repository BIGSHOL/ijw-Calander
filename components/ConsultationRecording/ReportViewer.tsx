import React, { useState, useMemo } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, Clock, User, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import type { ConsultationReport } from '../../types';
import { useReanalyzeReport } from '../../hooks/useConsultationRecording';
import { format } from 'date-fns';
import { formatReportContent } from '../../utils/formatReportContent';
import { HighlightedReportText } from '../../utils/HighlightedReportText';
import { ConversationFlowTree } from './ConversationFlowTree';

interface ReportViewerProps {
  report: ConsultationReport;
}

// TXT 다운로드용 전체 섹션 목록
const ALL_SECTIONS = [
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

// 대시보드 레이아웃 그룹
const PARENT_SECTIONS = [
  { key: 'parentConcerns' as const, label: '걱정/불안', emoji: '😟' },
  { key: 'parentQuestions' as const, label: '질문사항', emoji: '❓' },
  { key: 'parentRequests' as const, label: '요청사항', emoji: '🙋' },
  { key: 'parentSatisfaction' as const, label: '만족도/감정', emoji: '💭' },
];

const STUDENT_TEACHER_SECTIONS = [
  { key: 'familyContext' as const, label: '가정 배경', emoji: '👨‍👩‍👧' },
  { key: 'studentNotes' as const, label: '학생 특이사항', emoji: '📝' },
  { key: 'teacherResponse' as const, label: '교사 대응/설명', emoji: '🧑‍🏫' },
  { key: 'salesPoints' as const, label: '세일즈 포인트', emoji: '💼' },
];

const CONCLUSION_SECTIONS = [
  { key: 'agreements' as const, label: '합의된 사항', emoji: '🤝', color: 'blue' },
  { key: 'actionItems' as const, label: '후속 조치', emoji: '✅', color: 'green' },
  { key: 'riskFlags' as const, label: '주의 신호', emoji: '🚨', color: 'amber' },
];

const CONCLUSION_COLORS: Record<string, { bg: string; border: string; header: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'text-blue-800', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-800', text: 'text-green-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'text-amber-800', text: 'text-amber-700' },
};

export function ReportViewer({ report }: ReportViewerProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const reanalyzeMutation = useReanalyzeReport();

  // 기본 모두 펼침 — 초기값으로 모든 유효한 키 세팅
  const allValidKeys = useMemo(() => {
    if (!report.report) return [] as string[];
    return [...PARENT_SECTIONS, ...STUDENT_TEACHER_SECTIONS, ...CONCLUSION_SECTIONS]
      .filter(s => report.report?.[s.key])
      .map(s => s.key);
  }, [report.report]);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isExpanded = (key: string) => !collapsedSections.has(key);

  const toggleAll = () => {
    if (collapsedSections.size === 0) {
      setCollapsedSections(new Set(allValidKeys));
    } else {
      setCollapsedSections(new Set());
    }
  };

  const handleReanalyze = () => {
    if (!window.confirm('새 알고리즘으로 재분석하시겠습니까?\n기존 분석 결과가 덮어씌워집니다.')) return;
    reanalyzeMutation.mutate(report.id);
  };

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
      for (const section of ALL_SECTIONS) {
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

  // 접기/펼치기 가능한 섹션 카드
  const SectionCard = ({ sectionKey, label, emoji, className = '' }: { sectionKey: string; label: string; emoji: string; className?: string }) => {
    const content = report.report?.[sectionKey as keyof typeof report.report];
    if (!content) return null;
    const expanded = isExpanded(sectionKey);

    return (
      <div className={`border rounded-sm ${className}`}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-3 py-2 bg-gray-50/70 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <h4 className="text-xs font-semibold text-gray-700">{emoji} {label}</h4>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
        {expanded && (
          <div className="px-3 py-2 border-t">
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed"><HighlightedReportText content={content} /></p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-sm border shadow-sm">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b bg-green-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-green-700" />
          <div>
            <div className="flex items-center gap-2">
              {report.report?.consultationType && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-100 text-accent-700">
                  {String(report.report.consultationType).split('\n')[0].replace(/^-\s*/, '')}
                </span>
              )}
              <span className="text-sm font-semibold text-green-800">{report.studentName}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-green-600">
              <span className="flex items-center gap-1"><Calendar size={11} /> {report.consultationDate}</span>
              {report.durationSeconds != null && report.durationSeconds > 0 && (
                <span className="flex items-center gap-1"><Clock size={11} /> {Math.floor(report.durationSeconds / 60)}분 {report.durationSeconds % 60}초</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzeMutation.isPending}
            className="px-2.5 py-1.5 text-xs bg-white border border-accent-300 text-accent-700 rounded-sm hover:bg-accent-50 flex items-center gap-1 disabled:opacity-50"
            title="새 알고리즘으로 재분석"
          >
            {reanalyzeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            재분석
          </button>
          <button
            onClick={handleDownload}
            className="px-2.5 py-1.5 text-xs bg-white border border-green-300 text-green-700 rounded-sm hover:bg-green-50 flex items-center gap-1"
          >
            <Download size={12} /> TXT
          </button>
        </div>
      </div>

      {/* 재분석 진행 중 배너 */}
      {reanalyzeMutation.isPending && (
        <div className="mx-4 mt-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-purple-600 flex-shrink-0" />
          <p className="text-xs text-purple-700">새 알고리즘으로 재분석 중... (1~3분)</p>
        </div>
      )}

      {report.report && (
        <div className="p-4 space-y-3">
          {/* 모두 접기/펼치기 */}
          <div className="flex justify-end">
            <button onClick={toggleAll} className="text-xs text-gray-400 hover:text-accent-600 transition-colors">
              {collapsedSections.size === 0 ? '모두 접기' : '모두 펼치기'}
            </button>
          </div>

          {/* 요약 카드 — 항상 펼침 */}
          {report.report.summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-1.5">📋 상담 요약</h3>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                <HighlightedReportText content={report.report.summary} />
              </p>
            </div>
          )}

          {/* 2단 그리드: 학부모 분석 | 학생·교사 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* 왼쪽: 학부모 분석 */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">학부모 분석</h3>
              {PARENT_SECTIONS.map(s => (
                <SectionCard key={s.key} sectionKey={s.key} label={s.label} emoji={s.emoji} />
              ))}
            </div>

            {/* 오른쪽: 학생·교사 */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">학생·교사</h3>
              {STUDENT_TEACHER_SECTIONS.map(s => (
                <SectionCard key={s.key} sectionKey={s.key} label={s.label} emoji={s.emoji} />
              ))}
            </div>
          </div>

          {/* 결론 영역 — 3단 그리드 */}
          {CONCLUSION_SECTIONS.some(s => report.report?.[s.key]) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {CONCLUSION_SECTIONS.map(s => {
                const content = report.report?.[s.key as keyof typeof report.report];
                if (!content) return null;
                const colors = CONCLUSION_COLORS[s.color];
                return (
                  <div key={s.key} className={`${colors.bg} ${colors.border} border rounded-sm`}>
                    <div className="px-3 py-2 border-b border-inherit">
                      <h4 className={`text-xs font-semibold ${colors.header}`}>{s.emoji} {s.label}</h4>
                    </div>
                    <div className="px-3 py-2">
                      <p className={`text-xs ${colors.text} whitespace-pre-wrap leading-relaxed`}>
                        <HighlightedReportText content={content} />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 부록: 상담 흐름 수형도 */}
          {report.report?.conversationFlow && report.report.conversationFlow.length > 0 && (
            <div className="border rounded-sm">
              <button
                onClick={() => toggleSection('_conversationFlow')}
                className="w-full px-3 py-2 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h4 className="text-xs font-semibold text-gray-600">🌳 상담 흐름 수형도</h4>
                {isExpanded('_conversationFlow') ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {isExpanded('_conversationFlow') && (
                <div className="px-3 py-2 border-t">
                  <ConversationFlowTree flow={report.report.conversationFlow} />
                </div>
              )}
            </div>
          )}

          {/* 부록: 원본 음성인식 텍스트 */}
          {report.transcription && (
            <div className="border rounded-sm">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full px-3 py-2 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h4 className="text-xs font-semibold text-gray-600">🎤 원본 음성인식 텍스트</h4>
                {showTranscript ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {showTranscript && (
                <div className="px-3 py-2 max-h-80 overflow-auto border-t">
                  {report.speakerLabels && report.speakerLabels.length > 0 ? (
                    <div className="space-y-1.5">
                      {report.speakerRoles && Object.keys(report.speakerRoles).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b">
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
                          <div key={i} className="text-xs">
                            <span className="font-medium text-accent-600">[{role || `화자 ${s.speaker}`}]</span>{' '}
                            <span className="text-gray-700">{s.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{report.transcription}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
