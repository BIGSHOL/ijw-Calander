// Embed Token Manager Modal
// 관리자용 임베드 토큰 생성/관리 모달

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Plus,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Calendar,
  Clock,
  Eye,
  Link2,
  Settings,
  Check,
  QrCode,
  Download,
  UserCheck,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEmbedTokens, generateEmbedUrl } from '../../hooks/useEmbedTokens';
import {
  EmbedType,
  EmbedToken,
  CreateEmbedTokenInput,
  EmbedViewType,
  DEFAULT_EMBED_SETTINGS,
} from '../../types/embed';

interface EmbedTokenManagerProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  filterType?: EmbedType | EmbedType[];  // 특정 유형만 표시/생성 (등록상담: 'consultation-form', 시간표: ['math-timetable', 'english-timetable'])
}

const EMBED_TYPE_LABELS: Record<EmbedType, string> = {
  'math-timetable': '수학 시간표',
  'english-timetable': '영어 시간표',
  'consultation-form': '입학상담카드',
};

const EmbedTokenManager: React.FC<EmbedTokenManagerProps> = ({
  isOpen,
  onClose,
  staffId,
  filterType,
}) => {
  const { tokens: allTokens, loading, createToken, toggleToken, deleteToken } = useEmbedTokens();
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrTokenId, setQrTokenId] = useState<string | null>(null);  // QR코드 표시 중인 토큰 ID

  // filterType이 있으면 해당 유형만 표시
  const filterTypes = filterType ? (Array.isArray(filterType) ? filterType : [filterType]) : null;
  const tokens = filterTypes ? allTokens.filter(t => filterTypes.includes(t.type)) : allTokens;
  const isSingleFilter = filterTypes?.length === 1;
  const isConsultationOnly = isSingleFilter && filterTypes[0] === 'consultation-form';

  // 생성 폼 상태
  const [newToken, setNewToken] = useState<CreateEmbedTokenInput>({
    type: (isSingleFilter ? filterTypes[0] : filterTypes?.[0]) || 'math-timetable',
    name: '',
    expiresAt: undefined,
    settings: DEFAULT_EMBED_SETTINGS,
  });

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newToken.name.trim()) {
      alert('토큰 이름을 입력해주세요.');
      return;
    }

    try {
      await createToken(newToken, staffId);
      setIsCreating(false);
      setNewToken({
        type: (isSingleFilter ? filterTypes[0] : filterTypes?.[0]) || 'math-timetable',
        name: '',
        expiresAt: undefined,
        settings: DEFAULT_EMBED_SETTINGS,
      });
    } catch (err) {
      console.error('Token creation error:', err);
      alert('토큰 생성에 실패했습니다.');
    }
  };

  const handleCopyUrl = (token: EmbedToken) => {
    const url = generateEmbedUrl(token.type, token.token);
    navigator.clipboard.writeText(url);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (token: EmbedToken) => {
    if (!confirm(`"${token.name}" 토큰을 삭제하시겠습니까?`)) return;
    await deleteToken(token.id);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-800">
              {isConsultationOnly ? 'QR 입학상담 토큰 관리' : '임베드 공유 링크 관리'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 설명 */}
          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-indigo-800">
              {isConsultationOnly ? (
                <>토큰을 생성하면 학부모가 QR코드로 접속하여 상담 정보를 입력할 수 있는 URL이 만들어집니다.<br />URL을 QR코드로 변환하여 학원 데스크에 비치하세요.</>
              ) : (
                <>공유 링크를 생성하면 로그인 없이 시간표를 볼 수 있는 URL이 만들어집니다.<br />이 URL을 구글 스프레드시트, Notion, 웹페이지 등에 iframe으로 임베드할 수 있습니다.</>
              )}
            </p>
          </div>

          {/* 생성 버튼 / 폼 */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium mb-6"
            >
              <Plus className="w-4 h-4" />
              새 공유 링크 생성
            </button>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <h3 className="font-semibold text-gray-800">새 공유 링크 생성</h3>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 (용도 설명)
                </label>
                <input
                  type="text"
                  value={newToken.name}
                  onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                  placeholder="예: 학부모 공유용, 내부 모니터링용"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              {/* 유형 - 단일 필터일 때 숨김, 복수 필터일 때 해당 옵션만, 필터 없으면 전체 */}
              {!isSingleFilter && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    임베드 유형
                  </label>
                  <select
                    value={newToken.type}
                    onChange={(e) => setNewToken({ ...newToken, type: e.target.value as EmbedType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                  >
                    {(filterTypes || (['math-timetable', 'english-timetable', 'consultation-form'] as EmbedType[])).map(type => (
                      <option key={type} value={type} disabled={type === 'english-timetable'}>
                        {EMBED_TYPE_LABELS[type]}{type === 'english-timetable' ? ' (준비중)' : type === 'consultation-form' ? ' (학부모 QR 폼)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 뷰 타입 (시간표 전용) */}
              {newToken.type !== 'consultation-form' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  표시 형식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'teacher' as EmbedViewType, label: '강사뷰 (그리드)', desc: '교시별 강사 배치 표' },
                    { value: 'class' as EmbedViewType, label: '통합뷰 (카드)', desc: '수업별 카드 목록' },
                  ].map(({ value, label, desc }) => (
                    <label
                      key={value}
                      className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${
                        (newToken.settings?.viewType || 'class') === value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="viewType"
                          value={value}
                          checked={(newToken.settings?.viewType || 'class') === value}
                          onChange={(e) =>
                            setNewToken({
                              ...newToken,
                              settings: {
                                ...newToken.settings,
                                viewType: e.target.value as EmbedViewType,
                              },
                            })
                          }
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-800">{label}</span>
                      </div>
                      <span className="text-xs text-gray-500 mt-1 ml-6">{desc}</span>
                    </label>
                  ))}
                </div>
              </div>}

              {/* 만료일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  만료일 (선택사항)
                </label>
                <input
                  type="date"
                  value={newToken.expiresAt || ''}
                  onChange={(e) => setNewToken({ ...newToken, expiresAt: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">비워두면 무기한 유효</p>
              </div>

              {/* 표시 옵션 (시간표 전용) */}
              {newToken.type !== 'consultation-form' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  표시 옵션
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'showStudentList', label: '학생 목록' },
                    { key: 'showTeacherInfo', label: '강사 정보' },
                    { key: 'showClassroom', label: '강의실' },
                    { key: 'showSchedule', label: '스케줄 표' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 p-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={(newToken.settings as any)?.[key] ?? true}
                        onChange={(e) =>
                          setNewToken({
                            ...newToken,
                            settings: {
                              ...newToken.settings,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>}

              {/* 학생 상태 표시 옵션 (시간표 전용) */}
              {newToken.type !== 'consultation-form' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  학생 상태 표시
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'showHoldStudents', label: '대기 학생', desc: '휴원/대기 중인 학생' },
                    { key: 'showWithdrawnStudents', label: '퇴원 학생', desc: '퇴원한 학생' },
                  ].map(({ key, label, desc }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 p-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={(newToken.settings as any)?.[key] ?? false}
                        onChange={(e) =>
                          setNewToken({
                            ...newToken,
                            settings: {
                              ...newToken.settings,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="text-sm text-gray-700">{label}</span>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>}

              {/* 버튼 */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  생성
                </button>
              </div>
            </div>
          )}

          {/* 토큰 목록 */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>생성된 공유 링크가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className={`border rounded-lg p-4 transition-colors overflow-hidden ${
                    token.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  {/* 상단: 이름 + 배지 + 액션 */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-semibold text-gray-800 truncate">{token.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded shrink-0">
                        {EMBED_TYPE_LABELS[token.type]}
                      </span>
                      {token.type !== 'consultation-form' && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded shrink-0">
                          {token.settings?.viewType === 'teacher' ? '강사뷰' : '통합뷰'}
                        </span>
                      )}
                      {!token.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded shrink-0">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => window.open(generateEmbedUrl(token.type, token.token), '_blank')}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="새 탭에서 열기"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => toggleToken(token.id, !token.isActive)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={token.isActive ? '비활성화' : '활성화'}
                      >
                        {token.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(token)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* 중간: 메타 정보 */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      생성: {formatDate(token.createdAt)}
                    </span>
                    {token.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        만료: {formatDate(token.expiresAt)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      조회: {token.usageCount}회
                    </span>
                    {token.type === 'consultation-form' && (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <UserCheck className="w-3 h-3" />
                        제출: {token.submissionCount || 0}건
                      </span>
                    )}
                  </div>

                  {/* 하단: URL + 복사/QR 버튼 */}
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 px-3 py-1.5 bg-gray-100 rounded text-xs text-gray-600 truncate">
                      {generateEmbedUrl(token.type, token.token)}
                    </code>
                    <button
                      onClick={() => handleCopyUrl(token)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                        copiedId === token.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {copiedId === token.id ? (
                        <><Check className="w-3 h-3" /> 복사됨</>
                      ) : (
                        <><Copy className="w-3 h-3" /> 복사</>
                      )}
                    </button>
                    <button
                      onClick={() => setQrTokenId(qrTokenId === token.id ? null : token.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                        qrTokenId === token.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      title="QR코드"
                    >
                      <QrCode className="w-3 h-3" />
                      QR
                    </button>
                  </div>

                  {/* QR코드 표시 */}
                  {qrTokenId === token.id && (
                    <QrCodePanel url={generateEmbedUrl(token.type, token.token)} tokenName={token.name} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - iframe 사용 가이드 (시간표 전용) */}
        {!isConsultationOnly && <div className="px-6 py-4 border-t bg-gray-50">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-indigo-600">
              📖 임베드 사용 방법
            </summary>
            <div className="mt-3 space-y-3 text-gray-600">
              <p><strong>Google Apps Script (스프레드시트):</strong></p>
              <code className="block p-2 bg-gray-100 rounded text-xs overflow-x-auto whitespace-pre">
{`function openTimetable() {
  // 아래 URL을 위에서 복사한 공유 링크로 교체하세요
  var url = '여기에_복사한_URL_붙여넣기';

  var html = HtmlService.createHtmlOutput(
    '<style>*{margin:0;padding:0}iframe{width:100%;height:100%;border:none}</style>' +
    '<iframe src="' + url + '" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>'
  )
  .setWidth(1000)
  .setHeight(700)
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(html, '수학 시간표');
}`}
              </code>
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                <strong>주의:</strong> URL은 반드시 <code className="bg-amber-100 px-1 rounded">https://</code>로 시작하는 배포된 주소여야 합니다.
                localhost 주소는 Google Sheets에서 접근할 수 없습니다.
              </div>
              <p className="text-xs text-gray-500">
                스프레드시트 → 확장 프로그램 → Apps Script에 위 코드를 붙여넣고 실행하세요.
              </p>
            </div>
          </details>
        </div>}
      </div>
    </div>
  );
};

// QR코드 표시 패널
const QrCodePanel: React.FC<{ url: string; tokenName: string }> = ({ url, tokenName }) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR_${tokenName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [tokenName]);

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center gap-3">
      <div ref={qrRef} className="bg-white p-3 rounded-lg">
        <QRCodeCanvas
          value={url}
          size={200}
          level="H"
          marginSize={2}
        />
      </div>
      <p className="text-xs text-gray-500 text-center break-all max-w-[240px]">{url}</p>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        QR코드 다운로드
      </button>
    </div>
  );
};

export default EmbedTokenManager;
