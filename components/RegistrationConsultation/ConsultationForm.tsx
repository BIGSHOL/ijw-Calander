import React, { useState, useEffect, useCallback } from 'react';
import { ConsultationRecord, ConsultationStatus, SchoolGrade, ConsultationSubject, SubjectConsultationDetail } from '../../types';
import {
    X, ChevronDown, ChevronRight, User, Phone, Calendar, MapPin, School, BookOpen,
    FileText, Globe, Users, Cake, Home, Smile, AlertTriangle, Target, Tag, Bus,
    XCircle, CheckCircle, Banknote, Shield, UserCheck, GraduationCap, MessageSquare, ClipboardList, Droplet, Inbox,
    Pencil, Eye, FlaskConical, Mic, MicOff, Upload, Loader2, Square, ArrowDownToLine
} from 'lucide-react';
import { useRegistrationRecording, RegistrationExtractedData } from '../../hooks/useRegistrationRecording';
import { getKoreanErrorMessage } from '../../utils/errorMessages';
import { RecordingPickerModal, type SelectedRecording } from '../ConsultationRecording/RecordingPickerModal';
import type { ConsultationReportSection, SpeakerUtterance } from '../../types/consultationReport';
import { HighlightedReportText } from '../../utils/HighlightedReportText';
import { formatReportContent } from '../../utils/formatReportContent';
import { ConversationFlowTree } from '../ConsultationRecording/ConversationFlowTree';
import { useUpdateConsultationReportContent } from '../../hooks/useConsultationRecording';
import { usePermissions } from '../../hooks/usePermissions';
import type { UserProfile } from '../../types';
import { format } from 'date-fns';
import { Check } from 'lucide-react';

interface ConsultationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<ConsultationRecord, 'id'>) => void;
    initialData?: ConsultationRecord | null;
    onDelete?: (id: string) => void;
    onConvertToStudent?: (record: ConsultationRecord) => void;
    canDelete?: boolean;
    canConvert?: boolean;
    draftId?: string | null;
    userProfile?: UserProfile | null;
}

// Grade options - exclude legacy
const GRADE_OPTIONS = Object.values(SchoolGrade).filter(grade =>
    grade !== SchoolGrade.ElementaryLow && grade !== SchoolGrade.ElementaryHigh
);

const STATUS_OPTIONS = Object.values(ConsultationStatus);
const SUBJECT_OPTIONS = Object.values(ConsultationSubject);

// Custom Colors
const CUSTOM_COLORS = {
    NAVY: '#081429',
    YELLOW: '#fdb813',
    GRAY: '#373d41'
};

// 보호자 관계 옵션 (AddStudentModal과 동일)
const RELATION_OPTIONS = ['모', '부', '조부', '조모', '기타'];

// Helpers
const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

// 분석 보고서 섹션 정의
const REPORT_SECTIONS = [
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

/** AI 분석 탭 콘텐츠 - ReportViewer와 동일한 스타일 */
function AnalysisTabContent({ reportData, studentName, consultationDate, counselorName, reportId, canEdit, currentUser, lastEditedAt, lastEditedByName }: {
    reportData: {
        report?: ConsultationReportSection;
        speakerRoles?: Record<string, string>;
        transcription?: string;
        speakerLabels?: SpeakerUtterance[];
        durationSeconds?: number;
        studentName?: string;
        consultationDate?: string;
        consultantName?: string;
    } | null;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    reportId?: string | null;
    canEdit?: boolean;
    currentUser?: UserProfile | null;
    lastEditedAt?: number;
    lastEditedByName?: string;
}) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [showTranscript, setShowTranscript] = useState(false);
    const updateContentMutation = useUpdateConsultationReportContent('registration_recording_reports');

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
        if (!editingSection || !currentUser || !reportId) return;
        updateContentMutation.mutate({
            reportId,
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
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleAllSections = () => {
        if (!reportData?.report) return;
        const availableKeys = REPORT_SECTIONS.filter(s => reportData.report?.[s.key]).map(s => s.key);
        if (expandedSections.size >= availableKeys.length) {
            setExpandedSections(new Set());
        } else {
            setExpandedSections(new Set(availableKeys));
        }
    };

    // TXT 다운로드
    const handleDownload = () => {
        if (!reportData?.report) return;
        const name = reportData.studentName || studentName;
        const date = reportData.consultationDate || consultationDate;
        const lines: string[] = [
            '상담 녹음 분석 보고서',
            '='.repeat(40),
            `학생: ${name}`,
            `상담일: ${date}`,
            `상담자: ${reportData.consultantName || counselorName || '미지정'}`,
            reportData.durationSeconds ? `녹음 길이: ${Math.floor(reportData.durationSeconds / 60)}분 ${reportData.durationSeconds % 60}초` : '',
            '',
        ];
        for (const section of REPORT_SECTIONS) {
            const content = reportData.report[section.key];
            if (content) {
                lines.push(`[${section.label}]`);
                lines.push(formatReportContent(content));
                lines.push('');
            }
        }
        if (reportData.transcription) {
            lines.push('='.repeat(40));
            lines.push('[원본 음성인식 텍스트]');
            lines.push('');
            if (reportData.speakerLabels && reportData.speakerLabels.length > 0) {
                if (reportData.speakerRoles && Object.keys(reportData.speakerRoles).length > 0) {
                    lines.push(`[화자 식별] ${Object.entries(reportData.speakerRoles).map(([k, v]) => `화자 ${k} = ${v}`).join(', ')}`);
                    lines.push('');
                }
                reportData.speakerLabels.forEach(s => {
                    const role = reportData.speakerRoles?.[s.speaker];
                    lines.push(`[${role || `화자 ${s.speaker}`}] ${s.text}`);
                });
            } else {
                lines.push(reportData.transcription);
            }
        }
        const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `상담분석_${name}_${date}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 보고서 데이터가 없으면 안내 메시지
    if (!reportData?.report) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Mic size={40} className="mb-3 opacity-40" />
                <p className="text-sm font-medium text-gray-500 mb-1">녹음 파일 분석이 필요합니다</p>
                <p className="text-xs text-gray-400">상단의 &apos;녹음으로 AI 자동입력&apos; 기능을 이용하여<br />녹음 파일을 업로드하거나 직접 녹음해 주세요.</p>
            </div>
        );
    }

    const durationStr = reportData.durationSeconds
        ? `${Math.floor(reportData.durationSeconds / 60)}분 ${reportData.durationSeconds % 60}초`
        : null;

    return (
        <div className="bg-white rounded-sm border shadow-sm">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b bg-green-50 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <FileText size={16} />
                        분석 완료
                    </h2>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-green-600">
                        <span className="flex items-center gap-1">
                            <User size={10} /> {reportData.studentName || studentName}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar size={10} /> {reportData.consultationDate || consultationDate}
                        </span>
                        {durationStr && (
                            <span className="flex items-center gap-1">
                                <ClipboardList size={10} /> {durationStr}
                            </span>
                        )}
                    </div>
                    {lastEditedAt && (
                        <div className="text-[9px] text-green-500 mt-0.5">
                            수정: {format(new Date(lastEditedAt), 'yyyy-MM-dd HH:mm')} (KST) · {lastEditedByName || '알 수 없음'}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleDownload}
                    className="px-2.5 py-1.5 text-xs bg-white border border-green-300 text-green-700 rounded-sm hover:bg-green-50 flex items-center gap-1"
                >
                    <Inbox size={12} />
                    TXT 다운로드
                </button>
            </div>

            {/* 보고서 섹션 */}
            <div className="p-3 space-y-1">
                <div className="flex justify-end mb-1">
                    <button
                        type="button"
                        onClick={toggleAllSections}
                        className="text-[10px] text-gray-400 hover:text-accent-600 transition-colors"
                    >
                        {expandedSections.size >= REPORT_SECTIONS.filter(s => reportData.report?.[s.key]).length ? '모두 접기' : '모두 펼치기'}
                    </button>
                </div>
                {REPORT_SECTIONS.map(section => {
                    const content = reportData.report?.[section.key];
                    if (!content) return null;
                    const isExpanded = expandedSections.has(section.key);
                    const isEditing = editingSection === section.key;
                    return (
                        <div key={section.key} className="border rounded-sm">
                            <button
                                type="button"
                                onClick={() => toggleSection(section.key)}
                                className="w-full px-3 py-2.5 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
                            >
                                <h3 className="text-xs font-semibold text-gray-800">
                                    {section.emoji} {section.label}
                                </h3>
                                <div className="flex items-center gap-1">
                                    {canEdit && reportId && isExpanded && !isEditing && (
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); startEditing(section.key, content as string); }}
                                            className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="수정"
                                        >
                                            <Pencil size={11} />
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            {isExpanded && (
                                <div className="px-3 py-2 border-t">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                className="w-full min-h-[100px] p-2 text-xs text-gray-700 border rounded-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-2 justify-end">
                                                <button type="button" onClick={cancelEditing} className="px-2 py-1 text-[10px] text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-sm flex items-center gap-1">
                                                    <X size={10} /> 취소
                                                </button>
                                                <button type="button" onClick={saveEditing} disabled={updateContentMutation.isPending || editingText === content} className="px-2 py-1 text-[10px] text-white bg-blue-600 hover:bg-blue-700 rounded-sm flex items-center gap-1 disabled:opacity-50">
                                                    {updateContentMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                    저장
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed"><HighlightedReportText content={content} /></p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* 상담 흐름 수형도 */}
                {reportData.report?.conversationFlow && reportData.report.conversationFlow.length > 0 && (
                    <div className="border rounded-sm">
                        <button
                            type="button"
                            onClick={() => toggleSection('_conversationFlow')}
                            className="w-full px-3 py-2.5 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
                        >
                            <h3 className="text-xs font-semibold text-gray-800">
                                🌳 상담 흐름 수형도
                            </h3>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${expandedSections.has('_conversationFlow') ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.has('_conversationFlow') && (
                            <div className="px-3 py-2 border-t">
                                <ConversationFlowTree flow={reportData.report.conversationFlow} />
                            </div>
                        )}
                    </div>
                )}

                {/* 원본 음성인식 텍스트 */}
                {reportData.transcription && (
                    <div className="border rounded-sm">
                        <button
                            type="button"
                            onClick={() => setShowTranscript(!showTranscript)}
                            className="w-full px-3 py-2.5 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
                        >
                            <h3 className="text-xs font-semibold text-gray-600">
                                🎤 원본 음성인식 텍스트
                            </h3>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showTranscript ? 'rotate-180' : ''}`} />
                        </button>
                        {showTranscript && (
                            <div className="px-3 py-2 max-h-60 overflow-auto">
                                {reportData.speakerLabels && reportData.speakerLabels.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {reportData.speakerRoles && Object.keys(reportData.speakerRoles).length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2 pb-1.5 border-b">
                                                {Object.entries(reportData.speakerRoles).map(([key, role]) => (
                                                    <span key={key} className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent-50 text-accent-700 font-medium">
                                                        화자 {key} = {role}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {reportData.speakerLabels.map((s, i) => {
                                            const role = reportData.speakerRoles?.[s.speaker];
                                            return (
                                                <div key={i} className="text-xs">
                                                    <span className="font-medium text-accent-600">[{role || `화자 ${s.speaker}`}]</span>{' '}
                                                    <span className="text-gray-700">{s.text}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{reportData.transcription}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export const ConsultationForm: React.FC<ConsultationFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    onDelete,
    onConvertToStudent,
    canDelete = false,
    canConvert = false,
    draftId,
    userProfile
}) => {
    // 권한 체크
    const { hasPermission } = usePermissions(userProfile);
    const canEditReport = hasPermission('recording.edit');

    // 탭 상태 관리
    type TabType = 'basic' | 'math' | 'english' | 'korean' | 'science' | 'etc' | 'analysis';
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // 조회/편집 모드 (initialData가 있으면 기본 조회모드)
    const [isViewMode, setIsViewMode] = useState(false);

    // 확장 섹션 펼침 상태
    const [showAcademyInfo, setShowAcademyInfo] = useState(false);
    const [showFollowUp, setShowFollowUp] = useState(false);

    // 과목별 상담 정보 상태
    const [mathConsult, setMathConsult] = useState<SubjectConsultationDetail>({});
    const [englishConsult, setEnglishConsult] = useState<SubjectConsultationDetail>({});
    const [koreanConsult, setKoreanConsult] = useState<SubjectConsultationDetail>({});
    const [scienceConsult, setScienceConsult] = useState<SubjectConsultationDetail>({});
    const [etcConsult, setEtcConsult] = useState<SubjectConsultationDetail>({});

    const [formData, setFormData] = useState<Omit<ConsultationRecord, 'id'>>({
        // 학생 기본 정보
        studentName: '',
        gender: undefined,
        bloodType: '',
        schoolName: '',
        grade: SchoolGrade.Middle1,
        // 연락처
        studentPhone: '',
        parentPhone: '',
        parentName: '',
        parentRelation: '모',
        // 주소
        address: '',
        // 추가 정보
        birthDate: '',
        // 학원 전용 추가 정보
        safetyNotes: '',
        careerGoal: '',
        siblings: '',
        siblingsDetails: '',
        shuttleBusRequest: false,
        studentType: '',
        installmentAgreement: false,
        privacyAgreement: false,
        // 상담 정보
        consultationDate: getLocalDate(),
        subject: ConsultationSubject.English,
        status: ConsultationStatus.PendingThisMonth,
        counselor: '',
        receiver: '',
        registrar: '',
        paymentAmount: '',
        paymentDate: getLocalDate(),
        notes: '',
        nonRegistrationReason: '',
        followUpDate: getLocalDate(),
        followUpContent: '',
        consultationPath: '',
        createdAt: getLocalDate()
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                consultationDate: initialData.consultationDate.slice(0, 10),
                paymentDate: initialData.paymentDate ? initialData.paymentDate.slice(0, 10) : '',
                followUpDate: initialData.followUpDate ? initialData.followUpDate.slice(0, 10) : '',
                createdAt: initialData.createdAt ? initialData.createdAt.slice(0, 10) : getLocalDate(),
                // 필드 기본값 처리
                gender: initialData.gender,
                bloodType: initialData.bloodType || '',
                studentPhone: initialData.studentPhone || '',
                parentName: initialData.parentName || '',
                parentRelation: initialData.parentRelation || '모',
                address: initialData.address || '',
                birthDate: initialData.birthDate || '',
                // 학원 전용 추가 정보
                safetyNotes: initialData.safetyNotes || '',
                careerGoal: initialData.careerGoal || '',
                siblings: initialData.siblings || '',
                siblingsDetails: initialData.siblingsDetails || '',
                shuttleBusRequest: initialData.shuttleBusRequest || false,
                studentType: initialData.studentType || '',
                installmentAgreement: initialData.installmentAgreement || false,
                privacyAgreement: initialData.privacyAgreement || false,
            });
            // 모든 섹션 기본 접힘
            setShowAcademyInfo(false);
            setShowFollowUp(false);
            // 과목별 상담 정보 로드
            setMathConsult(initialData.mathConsultation || {});
            setEnglishConsult(initialData.englishConsultation || {});
            setKoreanConsult(initialData.koreanConsultation || {});
            setScienceConsult(initialData.scienceConsultation || {});
            setEtcConsult(initialData.etcConsultation || {});
            // 기존 레코드 열 때 조회 모드, draft에서 열 때 편집 모드
            setIsViewMode(!!initialData.id && !draftId);
        } else {
            setFormData({
                // 학생 기본 정보
                studentName: '',
                gender: undefined,
                bloodType: '',
                schoolName: '',
                grade: SchoolGrade.Middle1,
                // 연락처
                studentPhone: '',
                parentPhone: '',
                parentName: '',
                parentRelation: '모',
                // 주소
                address: '',
                // 추가 정보
                birthDate: '',
                // 학원 전용 추가 정보
                safetyNotes: '',
                careerGoal: '',
                siblings: '',
                siblingsDetails: '',
                shuttleBusRequest: false,
                studentType: '',
                installmentAgreement: false,
                privacyAgreement: false,
                // 상담 정보
                consultationDate: getLocalDate(),
                subject: ConsultationSubject.English,
                status: ConsultationStatus.PendingThisMonth,
                counselor: '',
                receiver: '',
                registrar: '',
                paymentAmount: '',
                paymentDate: getLocalDate(),
                notes: '',
                nonRegistrationReason: '',
                followUpDate: getLocalDate(),
                followUpContent: '',
                consultationPath: '',
                createdAt: getLocalDate()
            });
            setShowAcademyInfo(false);
            setShowFollowUp(false);
            // 과목별 상담 정보 초기화
            setMathConsult({});
            setEnglishConsult({});
            setKoreanConsult({});
            setScienceConsult({});
            setEtcConsult({});
            setIsViewMode(false);
        }
    }, [initialData, isOpen, draftId]);

    // ===== 녹음/분석 기능 =====
    const recording = useRegistrationRecording();
    const [showRecordingPanel, setShowRecordingPanel] = useState(false);
    const [recordingFile, setRecordingFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [showConsultationPicker, setShowConsultationPicker] = useState(false);

    // 오디오 파일 드래그 앤 드롭 핸들러
    const handleRecordingDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type.startsWith('audio/') || /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name))) {
            setRecordingFile(file);
            setShowRecordingPanel(true);
        }
    }, []);

    const handleRecordingDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleRecordingDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    // 교차 분석: 상담녹음에서 불러오기
    const handleImportFromConsultation = useCallback(async (selected: SelectedRecording) => {
        try {
            const studentContext: Record<string, unknown> = {};
            if (formData.schoolName) studentContext.schoolName = formData.schoolName;
            if (formData.grade) studentContext.grade = formData.grade;
            if (formData.parentName) studentContext.parentName = formData.parentName;
            if (formData.parentRelation) studentContext.parentRelation = formData.parentRelation;
            if (formData.parentPhone) studentContext.parentPhone = formData.parentPhone;
            if (formData.address) studentContext.address = formData.address;

            await recording.processFromPath({
                storagePath: selected.storagePath,
                studentName: formData.studentName || selected.studentName || '미입력',
                consultationDate: formData.consultationDate || selected.consultationDate || '',
                counselorName: formData.counselor || selected.consultantName || '',
                fileName: selected.fileName,
                ...(Object.keys(studentContext).length > 0 ? { studentContext } : {}),
            });
        } catch {
            // error handled by hook
        }
    }, [recording, formData]);

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // 녹음 분석 결과 → 폼 자동 채우기
    const applyExtractedData = useCallback((data: RegistrationExtractedData) => {
        const gradeMap: Record<string, SchoolGrade> = {
            '초1': SchoolGrade.Elementary1, '초2': SchoolGrade.Elementary2, '초3': SchoolGrade.Elementary3,
            '초4': SchoolGrade.Elementary4, '초5': SchoolGrade.Elementary5, '초6': SchoolGrade.Elementary6,
            '중1': SchoolGrade.Middle1, '중2': SchoolGrade.Middle2, '중3': SchoolGrade.Middle3,
            '고1': SchoolGrade.High1, '고2': SchoolGrade.High2, '고3': SchoolGrade.High3,
        };
        const subjectMap: Record<string, ConsultationSubject> = {
            '수학': ConsultationSubject.Math, '영어': ConsultationSubject.English,
            '국어': ConsultationSubject.Korean, '과학': ConsultationSubject.Science,
        };
        const statusMap: Record<string, ConsultationStatus> = {
            '영수등록': ConsultationStatus.EngMathRegistered, '수학등록': ConsultationStatus.MathRegistered,
            '영어등록': ConsultationStatus.EngRegistered, '국어등록': ConsultationStatus.KoreanRegistered,
            '과학등록': ConsultationStatus.ScienceRegistered, '이번달 등록예정': ConsultationStatus.PendingThisMonth,
            '추후 등록예정': ConsultationStatus.PendingFuture, '미등록': ConsultationStatus.NotRegistered,
            '등록완료': ConsultationStatus.Registered,
        };

        setFormData(prev => ({
            ...prev,
            studentName: data.studentName || prev.studentName,
            schoolName: data.schoolName || prev.schoolName,
            grade: gradeMap[data.grade || ''] || prev.grade,
            parentPhone: data.parentPhone || prev.parentPhone,
            parentName: data.parentName || prev.parentName,
            parentRelation: data.parentRelation || prev.parentRelation,
            address: data.address || prev.address,
            birthDate: data.birthDate || prev.birthDate,
            consultationPath: data.consultationPath || prev.consultationPath,
            enrollmentReason: data.enrollmentReason || prev.enrollmentReason,
            siblings: data.siblings || prev.siblings,
            shuttleBusRequest: data.shuttleBusRequest === true || data.shuttleBusRequest === 'true' || prev.shuttleBusRequest,
            safetyNotes: data.safetyNotes || prev.safetyNotes,
            careerGoal: data.careerGoal || prev.careerGoal,
            subject: subjectMap[data.subject || ''] || prev.subject,
            status: statusMap[data.status || ''] || prev.status,
            notes: data.notes || prev.notes,
            nonRegistrationReason: data.nonRegistrationReason || prev.nonRegistrationReason,
            followUpDate: data.followUpDate || prev.followUpDate,
            followUpContent: data.followUpContent || prev.followUpContent,
        }));
        if (data.mathConsultation) setMathConsult(data.mathConsultation as unknown as SubjectConsultationDetail);
        if (data.englishConsultation) setEnglishConsult(data.englishConsultation as unknown as SubjectConsultationDetail);
        if (data.koreanConsultation) setKoreanConsult(data.koreanConsultation as unknown as SubjectConsultationDetail);
        if (data.scienceConsultation) setScienceConsult(data.scienceConsultation as unknown as SubjectConsultationDetail);
    }, []);

    // extractedData가 변경되면 자동 채우기
    useEffect(() => {
        if (recording.extractedData) {
            applyExtractedData(recording.extractedData);
            setShowRecordingPanel(false);
        }
    }, [recording.extractedData, applyExtractedData]);

    const handleStartAnalysis = useCallback(async (file: File) => {
        try {
            // 폼에 입력된 학생 정보를 studentContext로 구성
            const studentContext: Record<string, unknown> = {};
            if (formData.schoolName) studentContext.schoolName = formData.schoolName;
            if (formData.grade) studentContext.grade = formData.grade;
            if (formData.parentName) studentContext.parentName = formData.parentName;
            if (formData.parentRelation) studentContext.parentRelation = formData.parentRelation;
            if (formData.parentPhone) studentContext.parentPhone = formData.parentPhone;
            if (formData.address) studentContext.address = formData.address;
            if (formData.birthDate) studentContext.birthDate = formData.birthDate;
            if (formData.gender) studentContext.gender = formData.gender;
            if (formData.siblings) studentContext.siblings = formData.siblings;

            await recording.uploadAndProcess({
                file,
                studentName: formData.studentName || '미입력',
                consultationDate: formData.consultationDate || getLocalDate(),
                counselorName: formData.counselor || '',
                ...(Object.keys(studentContext).length > 0 ? { studentContext } : {}),
            });
        } catch {
            // error handled by hook
        }
    }, [recording, formData]);

    const handleStopAndAnalyze = useCallback(async () => {
        try {
            const file = await recording.stopRecording();
            await handleStartAnalysis(file);
        } catch {
            // error handled by hook
        }
    }, [recording, handleStartAnalysis]);

    // Performance: rerender-functional-setstate - 안정적인 핸들러
    const handleChange = useCallback((field: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // 날짜 유효성 검사 및 변환 헬퍼 함수
    const validateAndConvertDate = (dateStr: string | undefined, fieldName: string, isRequired: boolean = false): string => {
        // 빈 값 처리
        if (!dateStr || dateStr.trim() === '') {
            if (isRequired) {
                throw new Error(`${fieldName}은(는) 필수 입력 항목입니다.`);
            }
            return '';
        }

        // 잘못된 형식 검사 (예: "T00:00:00." 같은 경우)
        if (dateStr.startsWith('T') || dateStr.length < 10) {
            console.warn(`⚠️ 잘못된 날짜 형식 감지: ${fieldName} = "${dateStr}"`);
            if (isRequired) {
                // 필수 필드면 오늘 날짜로 대체
                return new Date().toISOString();
            }
            return '';
        }

        // Date 객체 생성 및 유효성 검사
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.warn(`⚠️ 유효하지 않은 날짜: ${fieldName} = "${dateStr}"`);
            if (isRequired) {
                return new Date().toISOString();
            }
            return '';
        }

        return date.toISOString();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 각 날짜 필드를 검증하고 변환
            const consultationDateISO = validateAndConvertDate(formData.consultationDate, '상담일', true);
            const paymentDateISO = validateAndConvertDate(formData.paymentDate, '결제일', false);
            const followUpDateISO = validateAndConvertDate(formData.followUpDate, '후속조치일', false);
            const createdAtISO = validateAndConvertDate(formData.createdAt, '접수일', true);

            const submitData = {
                ...formData,
                consultationDate: consultationDateISO,
                paymentDate: paymentDateISO,
                followUpDate: followUpDateISO,
                createdAt: createdAtISO,
                mathConsultation: mathConsult,
                englishConsultation: englishConsult,
                koreanConsultation: koreanConsult,
                scienceConsultation: scienceConsult,
                etcConsultation: etcConsult
            };

            // Firestore는 undefined 값을 지원하지 않으므로 제거
            const cleanedData = Object.fromEntries(
                Object.entries(submitData).filter(([_, value]) => value !== undefined)
            ) as Omit<ConsultationRecord, 'id'>;

            onSubmit(cleanedData);
            // onClose()를 여기서 호출하지 않음 - 부모가 모달 상태를 관리
        } catch (error) {
            console.error('❌ Form submit error:', error);
            alert(getKoreanErrorMessage(error, '폼 제출 중 오류가 발생했습니다.'));
        }
    };

    const inputClass = `w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`;
    const labelClass = "block text-xs font-medium text-slate-600 mb-0.5";
    const viewProps = isViewMode ? { readOnly: true, tabIndex: -1 } : {};

    if (!isOpen) return null;

    // 탭 설정
    const tabs: { id: TabType; label: string; color: string; subjectKey?: 'math' | 'english' | 'korean' | 'science' | 'etc' }[] = [
        { id: 'basic', label: '기본 정보', color: CUSTOM_COLORS.NAVY },
        { id: 'math', label: '수학 상담', color: '#10b981', subjectKey: 'math' },
        { id: 'english', label: '영어 상담', color: '#3b82f6', subjectKey: 'english' },
        { id: 'korean', label: '국어 상담', color: '#f59e0b', subjectKey: 'korean' },
        { id: 'science', label: '과학 상담', color: '#ec4899', subjectKey: 'science' },
        { id: 'etc', label: '기타 상담', color: '#8b5cf6', subjectKey: 'etc' },
        { id: 'analysis', label: 'AI 분석', color: '#16a34a' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[3vh] z-[100]" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[94vh]">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-primary">
                            {draftId ? 'QR 접수 → 상담 등록' : initialData?.id ? (isViewMode ? '상담 기록 조회' : '상담 기록 수정') : '새 상담 등록'}
                        </h2>
                        {initialData?.id && (
                            <button
                                type="button"
                                onClick={() => setIsViewMode(!isViewMode)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                    isViewMode
                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                            >
                                {isViewMode ? <><Pencil size={11} /> 수정</> : <><Eye size={11} /> 조회</>}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* QR 접수 안내 배너 */}
                {draftId && (
                    <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm flex items-center gap-2 shrink-0">
                        <Inbox size={14} className="text-amber-600 shrink-0" />
                        <span className="text-xs text-amber-800">
                            학부모 QR 폼에서 접수된 데이터입니다. 내용을 확인/수정 후 등록하세요.
                        </span>
                    </div>
                )}

                {/* 녹음/분석 패널 */}
                {!isViewMode && (
                    <div className="mx-3 mt-2 shrink-0">
                        {!showRecordingPanel && recording.status === 'idle' && (
                            <div
                                onDrop={handleRecordingDrop}
                                onDragOver={handleRecordingDragOver}
                                onDragLeave={handleRecordingDragLeave}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors cursor-pointer border ${
                                    isDragOver
                                        ? 'bg-purple-100 border-purple-400 border-dashed ring-2 ring-purple-300'
                                        : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                                }`}
                                onClick={() => setShowRecordingPanel(true)}
                            >
                                <Mic size={14} />
                                {isDragOver ? '여기에 녹음 파일을 놓으세요' : '녹음으로 AI 자동입력'}
                                <span className="text-[10px] text-purple-400 ml-1">(파일 드래그 가능)</span>
                            </div>
                        )}
                        {showRecordingPanel && (
                            <div className="bg-purple-50 border border-purple-200 rounded-sm p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-purple-800 flex items-center gap-1">
                                        <Mic size={12} /> 상담 녹음 AI 분석
                                    </span>
                                    {recording.status === 'idle' && (
                                        <button type="button" onClick={() => { setShowRecordingPanel(false); setRecordingFile(null); }} className="text-gray-400 hover:text-gray-600">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {recording.status === 'idle' && !recording.isRecording && !recordingFile && (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => recording.startRecording()}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-sm text-xs font-bold transition-colors"
                                            >
                                                <Mic size={14} />
                                                녹음 시작
                                            </button>
                                            <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-50 cursor-pointer transition-colors">
                                                <Upload size={14} />
                                                파일 첨부
                                                <input
                                                    type="file"
                                                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) setRecordingFile(f);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <div
                                            onDrop={handleRecordingDrop}
                                            onDragOver={handleRecordingDragOver}
                                            onDragLeave={handleRecordingDragLeave}
                                            className={`border-2 border-dashed rounded-sm p-3 text-center text-[10px] transition-colors ${
                                                isDragOver
                                                    ? 'border-purple-400 bg-purple-100 text-purple-700'
                                                    : 'border-purple-200 text-purple-400'
                                            }`}
                                        >
                                            {isDragOver ? '여기에 놓으세요!' : '또는 녹음 파일을 여기로 드래그'}
                                        </div>
                                        {/* 상담녹음에서 불러오기 */}
                                        <button
                                            type="button"
                                            onClick={() => setShowConsultationPicker(true)}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-sm text-xs font-bold hover:bg-blue-50 transition-colors"
                                        >
                                            <ArrowDownToLine size={14} />
                                            상담녹음에서 불러오기
                                        </button>
                                        <RecordingPickerModal
                                            isOpen={showConsultationPicker}
                                            onClose={() => setShowConsultationPicker(false)}
                                            source="consultation"
                                            onSelect={handleImportFromConsultation}
                                        />
                                    </div>
                                )}

                                {recording.isRecording && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                            <span className="text-sm font-mono font-bold text-red-700">{formatDuration(recording.recordingDuration)}</span>
                                            <span className="text-[10px] text-red-500">녹음 중...</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleStopAndAnalyze}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-xs font-bold transition-colors"
                                        >
                                            <Square size={12} fill="currentColor" />
                                            정지 + AI 분석
                                        </button>
                                    </div>
                                )}

                                {recordingFile && recording.status === 'idle' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 bg-white border border-purple-200 rounded-sm">
                                            <Mic className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                            <span className="text-xs text-gray-700 truncate flex-1">{recordingFile.name}</span>
                                            <span className="text-[10px] text-gray-400">{(recordingFile.size / 1024 / 1024).toFixed(1)}MB</span>
                                            <button type="button" onClick={() => setRecordingFile(null)} className="p-0.5 hover:bg-gray-100 rounded">
                                                <X size={12} className="text-gray-400" />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleStartAnalysis(recordingFile)}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-xs font-bold transition-colors"
                                        >
                                            <Mic size={14} />
                                            AI 분석 시작
                                        </button>
                                    </div>
                                )}

                                {(recording.status === 'uploading' || recording.status === 'transcribing' || recording.status === 'analyzing') && (
                                    <div className="space-y-2">
                                        {recording.uploadProgress && (
                                            <div>
                                                <div className="flex justify-between text-[10px] text-purple-600 mb-0.5">
                                                    <span>업로드 중</span>
                                                    <span>{recording.uploadProgress.percent}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${recording.uploadProgress.percent}%` }} />
                                                </div>
                                            </div>
                                        )}
                                        {recording.status === 'transcribing' && (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                                                <span className="text-xs text-purple-700">음성 → 텍스트 변환 중...</span>
                                            </div>
                                        )}
                                        {recording.status === 'analyzing' && (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                                                <span className="text-xs text-purple-700">AI가 상담 내용 분석 중...</span>
                                            </div>
                                        )}
                                        {recording.statusMessage && (
                                            <p className="text-[10px] text-gray-500">{recording.statusMessage}</p>
                                        )}
                                    </div>
                                )}

                                {recording.status === 'completed' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-green-700">
                                            <CheckCircle size={14} className="text-green-600" />
                                            분석 완료! 폼에 자동 입력되었습니다.
                                        </div>
                                        {recording.reportData?.report && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('analysis')}
                                                className="text-[10px] text-accent-600 hover:underline flex items-center gap-1"
                                            >
                                                <FileText size={12} />
                                                AI 분석 보고서 보기
                                            </button>
                                        )}
                                    </div>
                                )}

                                {recording.status === 'error' && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs text-red-700">
                                            <AlertTriangle size={14} className="text-red-500" />
                                            {recording.error}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { recording.reset(); setRecordingFile(null); }}
                                            className="text-[10px] text-purple-600 hover:underline"
                                        >
                                            다시 시도
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 탭 네비게이션 */}
                <div className="flex border-b border-gray-200 px-3 shrink-0 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-2 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center gap-1 ${
                                activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            style={activeTab === tab.id ? {
                                borderBottom: `2px solid ${tab.color}`,
                                color: tab.color
                            } : {}}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* 기본 정보 탭 */}
                    {activeTab === 'basic' && (
                    <>
                    {/* 1. 접수 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-primary font-bold text-xs">접수 정보</h3>
                        </div>
                        <div className="p-2">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className={labelClass}><UserCheck size={12} className="inline mr-1" />상담자 <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    value={formData.counselor}
                                    onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                                    className={inputClass}
                                    placeholder="상담 선생님"
                                    {...viewProps}
                                />
                            </div>
                            <div>
                                <label className={labelClass}><Calendar size={12} className="inline mr-1" />접수일</label>
                                <input
                                    type="date"
                                    value={formData.createdAt}
                                    onChange={e => setFormData({ ...formData, createdAt: e.target.value })}
                                    className={inputClass}
                                    {...viewProps}
                                />
                            </div>
                            <div>
                                <label className={labelClass}><Globe size={12} className="inline mr-1" />상담 경로</label>
                                <input
                                    type="text"
                                    value={formData.consultationPath}
                                    onChange={e => setFormData({ ...formData, consultationPath: e.target.value })}
                                    className={inputClass}
                                    placeholder="지인소개"
                                    {...viewProps}
                                />
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* 2. 학생 + 상담 정보 (2열) */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* 학생 정보 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-primary font-bold text-xs">학생 정보</h3>
                            </div>
                            <div className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}><User size={12} className="inline mr-1" />학생 이름 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.studentName}
                                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Phone size={12} className="inline mr-1" />학생 전화</label>
                                    <input
                                        type="text"
                                        value={formData.studentPhone || ''}
                                        onChange={e => setFormData({ ...formData, studentPhone: e.target.value })}
                                        className={inputClass}
                                        placeholder="010-0000-0000"
                                        {...viewProps}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}><User size={12} className="inline mr-1" />보호자 성함</label>
                                    <input
                                        type="text"
                                        value={formData.parentName || ''}
                                        onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                                        className={inputClass}
                                        placeholder="김영희"
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Phone size={12} className="inline mr-1" />보호자 연락처</label>
                                    <input
                                        type="text"
                                        value={formData.parentPhone}
                                        onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}><School size={12} className="inline mr-1" />학교 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><GraduationCap size={12} className="inline mr-1" />학년 <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={formData.grade}
                                        onChange={e => setFormData({ ...formData, grade: e.target.value as SchoolGrade })}
                                        className={inputClass}
                                        disabled={isViewMode}
                                    >
                                        {GRADE_OPTIONS.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><MapPin size={12} className="inline mr-1" />주소 (동 또는 아파트)</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className={inputClass}
                                    placeholder="복현동"
                                    {...viewProps}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}><User size={12} className="inline mr-1" />성별</label>
                                    <select
                                        value={formData.gender || ''}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | undefined })}
                                        className={inputClass}
                                        disabled={isViewMode}
                                    >
                                        <option value="">선택 안함</option>
                                        <option value="male">남</option>
                                        <option value="female">여</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}><Droplet size={12} className="inline mr-1" />혈액형</label>
                                    <select
                                        value={formData.bloodType || ''}
                                        onChange={e => setFormData({ ...formData, bloodType: e.target.value })}
                                        className={inputClass}
                                        disabled={isViewMode}
                                    >
                                        <option value="">선택 안함</option>
                                        <option value="A">A형</option>
                                        <option value="B">B형</option>
                                        <option value="O">O형</option>
                                        <option value="AB">AB형</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}><Cake size={12} className="inline mr-1" />생년월일</label>
                                    <input
                                        type="date"
                                        value={formData.birthDate || ''}
                                        onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Users size={12} className="inline mr-1" />학생과의 관계</label>
                                    <select
                                        value={formData.parentRelation || '모'}
                                        onChange={e => setFormData({ ...formData, parentRelation: e.target.value })}
                                        className={inputClass}
                                        disabled={isViewMode}
                                    >
                                        {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            </div>
                        </div>

                        {/* 상담 정보 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-primary font-bold text-xs">상담 내용</h3>
                            </div>
                            <div className="p-2">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />상담일</label>
                                    <input
                                        type="date"
                                        value={formData.consultationDate}
                                        onChange={e => setFormData({ ...formData, consultationDate: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><BookOpen size={12} className="inline mr-1" />과목 <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value as ConsultationSubject })}
                                        className={inputClass}
                                        disabled={isViewMode}
                                    >
                                        {SUBJECT_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />상담 내용 <span className="text-red-500">*</span></label>
                                <textarea
                                    required
                                    rows={13}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className={`${inputClass} resize-none`}
                                    {...viewProps}
                                />
                            </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. 학원 관리 정보 (접을 수 있는 확장 섹션) */}
                    <div className="mb-2 border border-orange-200 rounded-sm bg-orange-50/30">
                        <button
                            type="button"
                            onClick={() => setShowAcademyInfo(!showAcademyInfo)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-orange-50 transition-colors rounded-sm"
                        >
                            <div className="flex items-center gap-2">
                                {showAcademyInfo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-sm font-bold text-orange-900">📋 학원 관리 정보 (선택)</span>
                                <span className="text-xs text-orange-600">안전사항, 희망진로, 남매 관계 등</span>
                            </div>
                        </button>

                        {showAcademyInfo && (
                            <div className="px-4 pb-4 pt-2 space-y-3">
                                <div>
                                    <label className={labelClass}><AlertTriangle size={12} className="inline mr-1" />안전사항</label>
                                    <textarea
                                        rows={2}
                                        value={formData.safetyNotes || ''}
                                        onChange={e => setFormData({ ...formData, safetyNotes: e.target.value })}
                                        className={`${inputClass} resize-none`}
                                        placeholder="알레르기, 주의사항 등"
                                        {...viewProps}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}><Target size={12} className="inline mr-1" />희망진로</label>
                                        <input
                                            type="text"
                                            value={formData.careerGoal || ''}
                                            onChange={e => setFormData({ ...formData, careerGoal: e.target.value })}
                                            className={inputClass}
                                            placeholder="의사, 교사 등"
                                            {...viewProps}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><Tag size={12} className="inline mr-1" />학생 구분</label>
                                        <input
                                            type="text"
                                            value={formData.studentType || ''}
                                            onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                            className={inputClass}
                                            placeholder="예비/재원"
                                            {...viewProps}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}><Users size={12} className="inline mr-1" />남매 관계</label>
                                        <input
                                            type="text"
                                            value={formData.siblings || ''}
                                            onChange={e => setFormData({ ...formData, siblings: e.target.value })}
                                            className={inputClass}
                                            placeholder="외동, 형제 2명 등"
                                            {...viewProps}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><Users size={12} className="inline mr-1" />남매 관계 기록</label>
                                        <input
                                            type="text"
                                            value={formData.siblingsDetails || ''}
                                            onChange={e => setFormData({ ...formData, siblingsDetails: e.target.value })}
                                            className={inputClass}
                                            placeholder="재원생 여부 등"
                                            {...viewProps}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={formData.shuttleBusRequest || false}
                                            onChange={e => setFormData({ ...formData, shuttleBusRequest: e.target.checked })}
                                            className="rounded"
                                            disabled={isViewMode}
                                        />
                                        <span className="text-slate-600"><Bus size={12} className="inline mr-1" />셔틀버스 신청</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. 후속 조치 (접을 수 있는 확장 섹션) */}
                    <div className="mb-2 border border-purple-200 rounded-sm bg-purple-50/30">
                        <button
                            type="button"
                            onClick={() => setShowFollowUp(!showFollowUp)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-50 transition-colors rounded-sm"
                        >
                            <div className="flex items-center gap-2">
                                {showFollowUp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-sm font-bold text-purple-900">📅 후속 조치 (선택)</span>
                                <span className="text-xs text-purple-600">후속 조치일, 미등록 사유 등</span>
                            </div>
                        </button>

                        {showFollowUp && (
                            <div className="px-4 pb-4 pt-2">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className={labelClass}><Calendar size={12} className="inline mr-1" />후속 조치일</label>
                                        <input
                                            type="date"
                                            value={formData.followUpDate}
                                            onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                                            className={inputClass}
                                            {...viewProps}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />조치 내용</label>
                                        <input
                                            type="text"
                                            value={formData.followUpContent}
                                            onChange={e => setFormData({ ...formData, followUpContent: e.target.value })}
                                            className={inputClass}
                                            {...viewProps}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}><XCircle size={12} className="inline mr-1" />미등록 사유</label>
                                    <input
                                        type="text"
                                        value={formData.nonRegistrationReason}
                                        onChange={e => setFormData({ ...formData, nonRegistrationReason: e.target.value })}
                                        className={inputClass}
                                        placeholder="등록 안한 이유"
                                        {...viewProps}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. 등록/결제 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-primary font-bold text-xs">등록 / 결제</h3>
                        </div>
                        <div className="p-2">
                            <div className="mb-2">
                                <label className={labelClass}><CheckCircle size={12} className="inline mr-1" />등록 상태</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as ConsultationStatus })}
                                    className={`${inputClass} bg-white`}
                                    disabled={isViewMode}
                                >
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><Banknote size={12} className="inline mr-1" />결제 금액</label>
                                    <input
                                        type="text"
                                        value={formData.paymentAmount}
                                        onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                        className={inputClass}
                                        placeholder="150,000"
                                        {...viewProps}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />결제일</label>
                                    <input
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                        className={inputClass}
                                        {...viewProps}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><UserCheck size={12} className="inline mr-1" />등록자</label>
                                <input
                                    type="text"
                                    value={formData.registrar}
                                    onChange={e => setFormData({ ...formData, registrar: e.target.value })}
                                    className={inputClass}
                                    placeholder="등록 처리자"
                                    {...viewProps}
                                />
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={formData.installmentAgreement || false}
                                        onChange={e => setFormData({ ...formData, installmentAgreement: e.target.checked })}
                                        className="rounded"
                                        disabled={isViewMode}
                                    />
                                    <span className="text-slate-600"><Shield size={12} className="inline mr-1" />할부 규정 안내 동의서</span>
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={formData.privacyAgreement || false}
                                        onChange={e => setFormData({ ...formData, privacyAgreement: e.target.checked })}
                                        className="rounded"
                                        disabled={isViewMode}
                                    />
                                    <span className="text-slate-600"><Shield size={12} className="inline mr-1" />개인정보 활용 동의서</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    {/* 과목별 상담 탭 공통 렌더러 */}
                    {(['math', 'english', 'korean', 'science', 'etc'] as const).map(subjectKey => {
                        if (activeTab !== subjectKey) return null;
                        const config: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; title: string; label: string }> = {
                            math: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: <BookOpen size={14} />, title: 'MATH', label: '수학' },
                            english: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: <Globe size={14} />, title: 'ENGLISH', label: '영어' },
                            korean: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: <FileText size={14} />, title: 'KOREAN', label: '국어' },
                            science: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', icon: <FlaskConical size={14} />, title: 'SCIENCE', label: '과학' },
                            etc: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', icon: <MessageSquare size={14} />, title: 'ETC', label: '기타' },
                        };
                        const c = config[subjectKey];
                        const consultMap: Record<string, [SubjectConsultationDetail, (v: SubjectConsultationDetail) => void]> = {
                            math: [mathConsult, setMathConsult],
                            english: [englishConsult, setEnglishConsult],
                            korean: [koreanConsult, setKoreanConsult],
                            science: [scienceConsult, setScienceConsult],
                            etc: [etcConsult, setEtcConsult],
                        };
                        const [consult, setConsult] = consultMap[subjectKey];
                        return (
                            <div key={subjectKey} className="bg-white border border-gray-200 overflow-hidden">
                                <div className={`px-2 py-1.5 ${c.bg} ${c.border} border-b`}>
                                    <h3 className={`${c.text} font-bold text-xs flex items-center gap-1`}>
                                        {c.icon}
                                        {c.title}
                                    </h3>
                                </div>
                                <div className="p-3 space-y-3">
                                    {subjectKey === 'math' ? (
                                        <div>
                                            <label className={labelClass}><ClipboardList size={12} className="inline mr-1" />레벨테스트 점수 (수학)</label>
                                            <div className="border border-emerald-200 rounded overflow-hidden">
                                                {/* 영역별 점수 행 */}
                                                <div className="grid grid-cols-4 bg-emerald-50/70">
                                                    {[
                                                        { key: 'calculationScore' as const, label: '계산력' },
                                                        { key: 'comprehensionScore' as const, label: '이해력' },
                                                        { key: 'reasoningScore' as const, label: '추론력' },
                                                        { key: 'problemSolvingScore' as const, label: '문제해결력' },
                                                    ].map((item, i) => (
                                                        <div key={item.key} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-emerald-200' : ''}`}>
                                                            <div className="text-[10px] font-semibold text-emerald-700 text-center mb-1">{item.label}</div>
                                                            <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-emerald-200 rounded-sm bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* 종합 점수 행 */}
                                                <div className="grid grid-cols-3 border-t border-emerald-200 bg-white">
                                                    {[
                                                        { key: 'myTotalScore' as const, label: '내 점수' },
                                                        { key: 'averageScore' as const, label: '평균 점수' },
                                                        { key: 'scoreGrade' as const, label: '등급' },
                                                    ].map((item, i) => (
                                                        <div key={item.key} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-emerald-200' : ''}`}>
                                                            <div className="text-[10px] font-medium text-slate-500 text-center mb-1">{item.label}</div>
                                                            <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-slate-200 rounded-sm bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : subjectKey === 'english' ? (
                                        <div>
                                            <label className={labelClass}><ClipboardList size={12} className="inline mr-1" />레벨테스트 (영어)</label>
                                            {/* 시험 종류 선택 */}
                                            <select
                                                value={consult.englishTestType || ''}
                                                onChange={e => setConsult({ ...consult, englishTestType: (e.target.value || undefined) as any })}
                                                className={`${inputClass} mb-2`}
                                                disabled={isViewMode}
                                            >
                                                <option value="">시험 종류 선택</option>
                                                <option value="ai">AI 레벨테스트</option>
                                                <option value="nelt">NELT Report</option>
                                                <option value="eie">EiE PTR</option>
                                            </select>

                                            {/* AI 레벨테스트 */}
                                            {consult.englishTestType === 'ai' && (
                                                <div className="border border-blue-200 rounded overflow-hidden">
                                                    <div className="grid grid-cols-4 bg-blue-50/70">
                                                        {[
                                                            { key: 'engLevel' as const, label: 'Lv' },
                                                            { key: 'engAiGradeLevel' as const, label: '학년 수준' },
                                                            { key: 'engAiArIndex' as const, label: 'AR 지수' },
                                                            { key: 'engAiTopPercent' as const, label: '상위 %' },
                                                        ].map((item, i) => (
                                                            <div key={item.key} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-blue-200' : ''}`}>
                                                                <div className="text-[10px] font-semibold text-blue-700 text-center mb-1">{item.label}</div>
                                                                <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-blue-200 rounded-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="border-t border-blue-200">
                                                        <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-blue-700 bg-blue-50/50 border-b border-blue-100">
                                                            <div className="px-2 py-1 w-14 text-center">영역</div>
                                                            <div className="px-2 py-1 text-center border-l border-blue-100">나의 레벨</div>
                                                            <div className="px-2 py-1 text-center border-l border-blue-100">회원평균</div>
                                                        </div>
                                                        {[
                                                            { label: '단어', myKey: 'engAiWordMy' as const, avgKey: 'engAiWordAvg' as const },
                                                            { label: '듣기', myKey: 'engAiListenMy' as const, avgKey: 'engAiListenAvg' as const },
                                                            { label: '읽기', myKey: 'engAiReadMy' as const, avgKey: 'engAiReadAvg' as const },
                                                            { label: '쓰기', myKey: 'engAiWriteMy' as const, avgKey: 'engAiWriteAvg' as const },
                                                        ].map((row, i) => (
                                                            <div key={row.label} className={`grid grid-cols-[auto_1fr_1fr] ${i < 3 ? 'border-b border-blue-100' : ''}`}>
                                                                <div className="px-2 py-1.5 w-14 text-[11px] font-medium text-slate-600 text-center bg-blue-50/30">{row.label}</div>
                                                                <div className="px-1 py-1 border-l border-blue-100">
                                                                    <input type="text" value={consult[row.myKey] || ''} onChange={e => setConsult({ ...consult, [row.myKey]: e.target.value })} className={`w-full px-1 py-0.5 text-sm text-center border border-slate-200 rounded-sm outline-none focus:border-blue-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                                </div>
                                                                <div className="px-1 py-1 border-l border-blue-100">
                                                                    <input type="text" value={consult[row.avgKey] || ''} onChange={e => setConsult({ ...consult, [row.avgKey]: e.target.value })} className={`w-full px-1 py-0.5 text-sm text-center border border-slate-200 rounded-sm outline-none focus:border-blue-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* NELT Report */}
                                            {consult.englishTestType === 'nelt' && (
                                                <div className="border border-violet-200 rounded overflow-hidden">
                                                    <div className="grid grid-cols-3 bg-violet-50/70">
                                                        {[
                                                            { key: 'engLevel' as const, label: 'Lv' },
                                                            { key: 'engNeltOverallLevel' as const, label: '종합 수준' },
                                                            { key: 'engNeltRank' as const, label: '동학년 석차' },
                                                        ].map((item, i) => (
                                                            <div key={item.key} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-violet-200' : ''}`}>
                                                                <div className="text-[10px] font-semibold text-violet-700 text-center mb-1">{item.label}</div>
                                                                <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-violet-200 rounded-sm bg-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-4 border-t border-violet-200 bg-white">
                                                        {[
                                                            { key: 'engNeltVocab' as const, label: '어휘' },
                                                            { key: 'engNeltGrammar' as const, label: '문법' },
                                                            { key: 'engNeltListening' as const, label: '듣기' },
                                                            { key: 'engNeltReading' as const, label: '독해' },
                                                        ].map((item, i) => (
                                                            <div key={item.key} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-violet-200' : ''}`}>
                                                                <div className="text-[10px] font-medium text-slate-500 text-center mb-1">{item.label}</div>
                                                                <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-slate-200 rounded-sm bg-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="수준" {...viewProps} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* EiE PTR */}
                                            {consult.englishTestType === 'eie' && (
                                                <div className="border border-sky-200 rounded overflow-hidden">
                                                    <div className="grid grid-cols-4 bg-sky-50/70">
                                                        {[
                                                            { key: 'engLevel' as const, label: 'Lv' },
                                                            { key: 'engEieGradeLevel' as const, label: '학년 수준' },
                                                            { key: 'engEieVocabLevel' as const, label: '어휘 수준' },
                                                            { key: 'engEieRank' as const, label: '동학년순위' },
                                                        ].map((item, i) => (
                                                            <div key={item.key} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-sky-200' : ''}`}>
                                                                <div className="text-[10px] font-semibold text-sky-700 text-center mb-1">{item.label}</div>
                                                                <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-sky-200 rounded-sm bg-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 border-t border-sky-200 bg-sky-50/40">
                                                        {[
                                                            { key: 'engEieCourse' as const, label: '과정' },
                                                            { key: 'engEieChartLevel' as const, label: '레벨' },
                                                            { key: 'engEieTextbook' as const, label: '교재' },
                                                        ].map((item, i) => (
                                                            <div key={item.key} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-sky-200' : ''}`}>
                                                                <div className="text-[10px] font-medium text-sky-600 text-center mb-1">{item.label}</div>
                                                                <input type="text" value={consult[item.key] || ''} onChange={e => setConsult({ ...consult, [item.key]: e.target.value })} className={`w-full px-1 py-1 text-sm text-center border border-sky-200 rounded-sm bg-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="border-t border-sky-200">
                                                        <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-sky-700 bg-sky-50/50 border-b border-sky-100">
                                                            <div className="px-2 py-1 w-20 text-center">영역</div>
                                                            <div className="px-2 py-1 text-center border-l border-sky-100">나의 레벨</div>
                                                            <div className="px-2 py-1 text-center border-l border-sky-100">회원평균</div>
                                                        </div>
                                                        {[
                                                            { label: 'Vocabulary', myKey: 'engEieVocabMy' as const, avgKey: 'engEieVocabAvg' as const },
                                                            { label: 'Listening', myKey: 'engEieListenMy' as const, avgKey: 'engEieListenAvg' as const },
                                                            { label: 'Reading', myKey: 'engEieReadMy' as const, avgKey: 'engEieReadAvg' as const },
                                                            { label: 'Grammar', myKey: 'engEieGrammarMy' as const, avgKey: 'engEieGrammarAvg' as const },
                                                        ].map((row, i) => (
                                                            <div key={row.label} className={`grid grid-cols-[auto_1fr_1fr] ${i < 3 ? 'border-b border-sky-100' : ''}`}>
                                                                <div className="px-2 py-1.5 w-20 text-[11px] font-medium text-slate-600 text-center bg-sky-50/30">{row.label}</div>
                                                                <div className="px-1 py-1 border-l border-sky-100">
                                                                    <input type="text" value={consult[row.myKey] || ''} onChange={e => setConsult({ ...consult, [row.myKey]: e.target.value })} className={`w-full px-1 py-0.5 text-sm text-center border border-slate-200 rounded-sm outline-none focus:border-sky-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                                </div>
                                                                <div className="px-1 py-1 border-l border-sky-100">
                                                                    <input type="text" value={consult[row.avgKey] || ''} onChange={e => setConsult({ ...consult, [row.avgKey]: e.target.value })} className={`w-full px-1 py-0.5 text-sm text-center border border-slate-200 rounded-sm outline-none focus:border-sky-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`} placeholder="-" {...viewProps} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className={labelClass}><ClipboardList size={12} className="inline mr-1" />레벨테스트 점수 ({c.label})</label>
                                            <input type="text" value={consult.levelTestScore || ''} onChange={e => setConsult({ ...consult, levelTestScore: e.target.value })} className={inputClass} placeholder={`${c.label} 레벨 미실시`} {...viewProps} />
                                        </div>
                                    )}
                                    <div>
                                        <label className={labelClass}><FileText size={12} className="inline mr-1" />학원 히스토리 ({c.label})</label>
                                        <textarea rows={2} value={consult.academyHistory || ''} onChange={e => setConsult({ ...consult, academyHistory: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><BookOpen size={12} className="inline mr-1" />학습 진도 ({c.label})</label>
                                        <textarea rows={2} value={consult.learningProgress || ''} onChange={e => setConsult({ ...consult, learningProgress: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><CheckCircle size={12} className="inline mr-1" />학생 시험 성적 ({c.label})</label>
                                        <textarea rows={2} value={consult.examResults || ''} onChange={e => setConsult({ ...consult, examResults: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />학생 상담 내역 ({c.label})</label>
                                        <textarea rows={2} value={consult.consultationHistory || ''} onChange={e => setConsult({ ...consult, consultationHistory: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelClass}><Tag size={12} className="inline mr-1" />추천반 ({c.label})</label>
                                            <input type="text" value={consult.recommendedClass || ''} onChange={e => setConsult({ ...consult, recommendedClass: e.target.value })} className={inputClass} placeholder="비어 있음" {...viewProps} />
                                        </div>
                                        <div>
                                            <label className={labelClass}><User size={12} className="inline mr-1" />담임 ({c.label})</label>
                                            <input type="text" value={consult.homeRoomTeacher || ''} onChange={e => setConsult({ ...consult, homeRoomTeacher: e.target.value })} className={inputClass} placeholder="비어 있음" {...viewProps} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}><Calendar size={12} className="inline mr-1" />첫 수업일 ({c.label})</label>
                                        <input type="date" value={consult.firstClassDate || ''} onChange={e => setConsult({ ...consult, firstClassDate: e.target.value })} className={inputClass} {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><FileText size={12} className="inline mr-1" />기타</label>
                                        <textarea rows={2} value={consult.notes || ''} onChange={e => setConsult({ ...consult, notes: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* AI 분석 탭 */}
                    {activeTab === 'analysis' && (
                        <AnalysisTabContent reportData={recording.reportData} studentName={formData.studentName} consultationDate={formData.consultationDate || ''} counselorName={formData.counselor} reportId={recording.reportId} canEdit={canEditReport} currentUser={userProfile} />
                    )}

                    {/* 버튼 */}
                    <div className="mt-4 flex justify-between items-center pt-3 border-t">
                        <div className="flex gap-2">
                            {/* 조회 모드: 원생 전환, 삭제 등 액션 */}
                            {isViewMode ? (
                                <>
                                    {initialData && canConvert && onConvertToStudent && !initialData.registeredStudentId && (
                                        <button
                                            type="button"
                                            onClick={() => onConvertToStudent(initialData)}
                                            className="px-4 py-2 text-sm rounded-sm border border-green-300 text-green-600 font-medium hover:bg-green-50 transition-colors flex items-center gap-1"
                                        >
                                            <User size={14} />
                                            원생 전환
                                        </button>
                                    )}
                                    {initialData && initialData.registeredStudentId && (
                                        <span className="px-4 py-2 text-xs bg-green-100 text-green-800 rounded-sm font-medium">
                                            ✓ 원생 전환 완료
                                        </span>
                                    )}
                                    {initialData && canDelete && onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('정말로 삭제하시겠습니까?')) {
                                                    onDelete(initialData.id);
                                                    onClose();
                                                }
                                            }}
                                            className="px-4 py-2 text-sm rounded-sm border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* 편집 모드: 삭제 + 원생 전환 */}
                                    {initialData && canDelete && onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('정말로 삭제하시겠습니까?')) {
                                                    onDelete(initialData.id);
                                                    onClose();
                                                }
                                            }}
                                            className="px-4 py-2 text-sm rounded-sm border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                                        >
                                            삭제
                                        </button>
                                    )}
                                    {initialData && canConvert && onConvertToStudent && !initialData.registeredStudentId && (
                                        <button
                                            type="button"
                                            onClick={() => onConvertToStudent(initialData)}
                                            className="px-4 py-2 text-sm rounded-sm border border-green-300 text-green-600 font-medium hover:bg-green-50 transition-colors flex items-center gap-1"
                                        >
                                            <User size={14} />
                                            원생 전환
                                        </button>
                                    )}
                                    {initialData && initialData.registeredStudentId && (
                                        <span className="px-4 py-2 text-xs bg-green-100 text-green-800 rounded-sm font-medium">
                                            ✓ 원생 전환 완료
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-sm border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                            >
                                {isViewMode ? '닫기' : '취소'}
                            </button>
                            {!isViewMode && (
                                <button
                                    type="submit"
                                    style={{ backgroundColor: CUSTOM_COLORS.NAVY }}
                                    className="px-4 py-2 text-sm rounded-sm text-white font-medium hover:opacity-90 shadow-sm transition-all"
                                >
                                    {initialData?.id ? '수정 완료' : '등록'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
