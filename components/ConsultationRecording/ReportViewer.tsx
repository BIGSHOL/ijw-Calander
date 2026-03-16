import React, { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, Clock, User, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import type { ConsultationReport } from '../../types';
import { useReanalyzeReport } from '../../hooks/useConsultationRecording';
import { format } from 'date-fns';

interface ReportViewerProps {
  report: ConsultationReport;
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

// 불릿 포인트가 줄바꿈 없이 이어진 경우 강제 줄바꿈 처리
function formatContent(text: unknown): string {
  // 배열인 경우 (구버전 Firestore 데이터)
  if (Array.isArray(text)) {
    return text
      .map(item => String(item).trim())
      .filter(Boolean)
      .map(item => item.startsWith('-') ? item : `- ${item}`)
      .join('\n');
  }
  if (typeof text !== 'string') return String(text ?? '');

  // 이미 줄바꿈이 있으면 그대로 반환 (새 녹음)
  if (text.includes('\n')) return text.trim();

  // 기존 데이터: ",- " 패턴으로 이어진 불릿을 줄바꿈으로 분리
  const parts = text.split(/,\s*(?=- )/);
  return parts
    .map(p => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function ReportViewer({ report }: ReportViewerProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const reanalyzeMutation = useReanalyzeReport();

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
          lines.push(formatContent(content));
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
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={handleDownload}
            className="px-3 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-sm hover:bg-green-50 flex items-center gap-1.5"
          >
            <Download size={14} />
            TXT 다운로드
          </button>
        </div>
      </div>

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
      <div className="p-5 space-y-4">
        {report.report && SECTIONS.map(section => {
          const content = report.report?.[section.key];
          if (!content) return null;

          return (
            <div key={section.key} className="border rounded-sm">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-800">
                  {section.emoji} {section.label}
                </h3>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{formatContent(content)}</p>
              </div>
            </div>
          );
        })}

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
