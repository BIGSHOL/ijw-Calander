import React, { useState, useEffect, useMemo } from 'react';
import { Resource, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ICONS, RESOURCE_CATEGORY_TREE, CATEGORY_SEPARATOR, EMOJI_LIST } from '../../types';
import { X, Link2, Loader2, ChevronRight, AlertTriangle, CheckCircle2, FileText, FolderTree, Palette } from 'lucide-react';

interface ResourceAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editingResource?: Resource | null;
  existingCategories: string[];
  existingUrls: string[]; // 중복 체크용 URL 목록
  currentUserName: string;
  currentUserId: string;
}

/**
 * URL에서 리소스 타입 자동 감지
 */
function detectResourceType(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('notion.so') || hostname.includes('notion.site')) {
      return 'notion';
    }
    if (hostname.includes('docs.google.com')) {
      if (url.includes('/document/')) return 'google_docs';
      if (url.includes('/spreadsheets/')) return 'google_sheets';
    }
    if (hostname.includes('drive.google.com')) {
      return 'google_drive';
    }
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }
    return 'other';
  } catch {
    return 'other';
  }
}

const ResourceAddModal: React.FC<ResourceAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingResource,
  existingCategories,
  existingUrls,
  currentUserName,
  currentUserId,
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('other');
  const [customType, setCustomType] = useState('');
  // 계층형 카테고리 상태
  const [categoryMain, setCategoryMain] = useState('');
  const [categorySub, setCategorySub] = useState('');
  const [categoryDetail, setCategoryDetail] = useState('');
  // 직접 입력 상태
  const [customMain, setCustomMain] = useState('');
  const [customSub, setCustomSub] = useState('');
  const [customDetail, setCustomDetail] = useState('');
  const [icon, setIcon] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; message: string } | null>(null);

  // URL 유효성 검사 함수
  const validateUrl = async (urlToCheck: string) => {
    if (!urlToCheck.trim()) {
      setUrlValidation(null);
      return;
    }

    // 기본 URL 형식 체크
    try {
      new URL(urlToCheck);
    } catch {
      setUrlValidation({ valid: false, message: 'URL 형식이 올바르지 않습니다' });
      return;
    }

    // HTTP/HTTPS 프로토콜 체크
    if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
      setUrlValidation({ valid: false, message: 'http:// 또는 https://로 시작해야 합니다' });
      return;
    }

    // 서버 접근 가능 여부 확인 (CORS 우회를 위해 HEAD 요청 시도)
    setIsValidatingUrl(true);
    try {
      // 알려진 서비스는 검증 스킵 (CORS 정책 때문에 직접 확인 불가)
      const knownDomains = ['notion.so', 'notion.site', 'google.com', 'youtube.com', 'youtu.be', 'drive.google.com', 'docs.google.com'];
      const urlObj = new URL(urlToCheck);
      const isKnownDomain = knownDomains.some(domain => urlObj.hostname.includes(domain));

      if (isKnownDomain) {
        setUrlValidation({ valid: true, message: '알려진 서비스 URL입니다' });
      } else {
        // 알 수 없는 도메인은 형식만 확인
        setUrlValidation({ valid: true, message: 'URL 형식이 유효합니다' });
      }
    } catch {
      setUrlValidation({ valid: true, message: 'URL 형식이 유효합니다' });
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // 중복 URL 체크 (수정 모드에서는 자기 자신 제외)
  const isDuplicateUrl = useMemo(() => {
    if (!url.trim()) return false;
    const normalizedUrl = url.trim().toLowerCase();
    // 수정 모드일 때는 현재 리소스의 URL 제외
    const urlsToCheck = editingResource
      ? existingUrls.filter(u => u.toLowerCase() !== editingResource.url.toLowerCase())
      : existingUrls;
    return urlsToCheck.some(u => u.toLowerCase() === normalizedUrl);
  }, [url, existingUrls, editingResource]);

  // 최종 타입 (커스텀 타입 우선)
  const finalType = useMemo(() => {
    return type === '__custom__' ? customType : type;
  }, [type, customType]);

  // 대분류 목록
  const mainCategories = useMemo(() => Object.keys(RESOURCE_CATEGORY_TREE), []);

  // 중분류 목록 (대분류 선택 시)
  const subCategories = useMemo(() => {
    if (!categoryMain || !RESOURCE_CATEGORY_TREE[categoryMain]) return [];
    return Object.keys(RESOURCE_CATEGORY_TREE[categoryMain]);
  }, [categoryMain]);

  // 소분류 목록 (중분류 선택 시)
  const detailCategories = useMemo(() => {
    if (!categoryMain || !categorySub) return [];
    const tree = RESOURCE_CATEGORY_TREE[categoryMain];
    if (!tree || !tree[categorySub]) return [];
    return tree[categorySub];
  }, [categoryMain, categorySub]);

  // 최종 카테고리 문자열 생성 (직접 입력값 우선)
  const finalCategory = useMemo(() => {
    const main = categoryMain === '__custom__' ? customMain : categoryMain;
    const sub = categorySub === '__custom__' ? customSub : categorySub;
    const detail = categoryDetail === '__custom__' ? customDetail : categoryDetail;
    const parts = [main, sub, detail].filter(Boolean);
    return parts.length > 0 ? parts.join(CATEGORY_SEPARATOR) : '기타';
  }, [categoryMain, categorySub, categoryDetail, customMain, customSub, customDetail]);

  // 카테고리 문자열 파싱 (수정 모드용)
  const parseCategoryPath = (categoryPath: string) => {
    const parts = categoryPath.split(CATEGORY_SEPARATOR).map(p => p.trim());
    return {
      main: parts[0] || '',
      sub: parts[1] || '',
      detail: parts[2] || '',
    };
  };

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (editingResource) {
      setTitle(editingResource.title);
      setUrl(editingResource.url);
      setDescription(editingResource.description || '');
      // 타입이 기본 타입인지 커스텀 타입인지 확인
      const isDefaultType = Object.keys(RESOURCE_TYPE_LABELS).includes(editingResource.type);
      if (isDefaultType) {
        setType(editingResource.type);
        setCustomType('');
      } else {
        setType('__custom__');
        setCustomType(editingResource.type);
      }
      // 카테고리 파싱
      const parsed = parseCategoryPath(editingResource.category);
      setCategoryMain(parsed.main);
      setCategorySub(parsed.sub);
      setCategoryDetail(parsed.detail);
      setIcon(editingResource.icon || '');
      setIsPinned(editingResource.isPinned);
    } else {
      // 초기화
      setTitle('');
      setUrl('');
      setDescription('');
      setType('other');
      setCustomType('');
      setCategoryMain('');
      setCategorySub('');
      setCategoryDetail('');
      setIcon('');
      setShowEmojiPicker(false);
      setIsPinned(false);
    }
    // URL 유효성 상태 초기화
    setUrlValidation(null);
    setIsValidatingUrl(false);
  }, [editingResource, isOpen]);

  // URL 변경 시 타입 자동 감지
  useEffect(() => {
    if (url && !editingResource) {
      const detected = detectResourceType(url);
      setType(detected);
      // 기본 아이콘도 설정
      if (!icon) {
        setIcon(RESOURCE_TYPE_ICONS[detected] || '');
      }
    }
  }, [url, editingResource, icon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !url.trim()) {
      alert('제목과 URL은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Firestore는 undefined를 지원하지 않으므로 null 또는 빈 값 사용
      const resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        url: url.trim(),
        type: finalType,
        category: finalCategory,
        icon: icon || '',  // 아이콘 없으면 빈 문자열
        order: editingResource?.order ?? 0,
        isPinned,
        createdBy: editingResource?.createdBy || currentUserId,
        createdByName: editingResource?.createdByName || currentUserName,
      };

      // 선택적 필드는 값이 있을 때만 추가
      if (description.trim()) {
        resourceData.description = description.trim();
      }

      await onSubmit(resourceData);
      onClose();
    } catch (error) {
      console.error('리소스 저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      {/* 모달 */}
      <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Link2 size={18} className="text-accent" />
            {editingResource ? '리소스 수정' : '리소스 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* URL 정보 섹션 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Link2 className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">URL 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* URL */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">URL<span className="text-red-500">*</span></span>
                <div className="flex-1 relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setUrlValidation(null); // 입력 중에는 초기화
                    }}
                    onBlur={() => validateUrl(url)}
                    placeholder="https://notion.so/... 또는 https://drive.google.com/..."
                    className={`w-full px-2 py-1 pr-6 text-xs border rounded-sm focus:ring-1 focus:border-accent outline-none ${
                      isDuplicateUrl || (urlValidation && !urlValidation.valid)
                        ? 'border-orange-400 focus:border-orange-400 focus:ring-orange-400'
                        : urlValidation?.valid
                        ? 'border-green-400 focus:border-green-400 focus:ring-green-400'
                        : 'border-gray-300 focus:ring-accent'
                    }`}
                    required
                  />
                  {isValidatingUrl && (
                    <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                  {!isValidatingUrl && urlValidation?.valid && !isDuplicateUrl && (
                    <CheckCircle2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />
                  )}
                  {!isValidatingUrl && (isDuplicateUrl || (urlValidation && !urlValidation.valid)) && (
                    <AlertTriangle size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-500" />
                  )}
                </div>
              </div>
              {/* URL 검증 메시지 */}
              {(isDuplicateUrl || urlValidation) && (
                <div className="px-2 py-1.5">
                  <div className="ml-16">
                    {isDuplicateUrl && (
                      <p className="text-xxs text-orange-500 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        이 URL은 이미 등록되어 있습니다
                      </p>
                    )}
                    {!isDuplicateUrl && urlValidation && !urlValidation.valid && (
                      <p className="text-xxs text-orange-500 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        {urlValidation.message}
                      </p>
                    )}
                    {!isDuplicateUrl && urlValidation?.valid && (
                      <p className="text-xxs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        {urlValidation.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* 타입 자동 감지 메시지 */}
              {!isDuplicateUrl && !urlValidation && type !== 'other' && type !== '__custom__' && RESOURCE_TYPE_LABELS[type] && (
                <div className="px-2 py-1.5">
                  <div className="ml-16">
                    <p className="text-xxs text-accent">
                      자동 감지: {RESOURCE_TYPE_ICONS[type]} {RESOURCE_TYPE_LABELS[type]}
                    </p>
                  </div>
                </div>
              )}
              {/* 제목 */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">제목<span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="리소스 제목"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* 상세 정보 섹션 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <FileText className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">상세 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 설명 */}
              <div className="flex items-start gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700 pt-1">설명</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="리소스에 대한 간단한 설명"
                  rows={2}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none resize-none"
                />
              </div>
              {/* 타입 */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">타입</span>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    if (e.target.value !== '__custom__') {
                      setCustomType('');
                    }
                  }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                >
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {RESOURCE_TYPE_ICONS[key]} {label}
                    </option>
                  ))}
                  <option value="__custom__">+ 새 타입 추가</option>
                </select>
              </div>
              {/* 커스텀 타입 입력 */}
              {type === '__custom__' && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-14 shrink-0 text-xs font-medium text-primary-700"></span>
                  <input
                    type="text"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="새 타입 이름 입력"
                    className="flex-1 px-2 py-1 text-xs border border-accent rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 분류 섹션 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <FolderTree className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">분류</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 대분류 */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">대분류</span>
                <select
                  value={categoryMain}
                  onChange={(e) => {
                    setCategoryMain(e.target.value);
                    setCategorySub('');
                    setCategoryDetail('');
                    setCustomMain('');
                  }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                >
                  <option value="">대분류 선택</option>
                  {mainCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__custom__">+ 새 대분류 추가</option>
                </select>
              </div>
              {/* 대분류 커스텀 입력 */}
              {categoryMain === '__custom__' && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-14 shrink-0 text-xs font-medium text-primary-700"></span>
                  <input
                    type="text"
                    value={customMain}
                    onChange={(e) => setCustomMain(e.target.value)}
                    placeholder="새 대분류 이름 입력"
                    className="flex-1 px-2 py-1 text-xs border border-accent rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              )}
              {/* 중분류 */}
              {categoryMain && categoryMain !== '__custom__' && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-14 shrink-0 text-xs font-medium text-primary-700 flex items-center gap-1">
                    <ChevronRight size={10} className="text-gray-400" />
                    중분류
                  </span>
                  <select
                    value={categorySub}
                    onChange={(e) => {
                      setCategorySub(e.target.value);
                      setCategoryDetail('');
                      setCustomSub('');
                    }}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  >
                    <option value="">중분류 선택 (선택사항)</option>
                    {subCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__custom__">+ 새 중분류 추가</option>
                  </select>
                </div>
              )}
              {/* 중분류 커스텀 입력 */}
              {categorySub === '__custom__' && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-14 shrink-0 text-xs font-medium text-primary-700"></span>
                  <input
                    type="text"
                    value={customSub}
                    onChange={(e) => setCustomSub(e.target.value)}
                    placeholder="새 중분류 이름 입력"
                    className="flex-1 px-2 py-1 text-xs border border-accent rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              )}
              {/* 카테고리 미리보기 */}
              {(categoryMain || customMain) && (
                <div className="px-2 py-1.5">
                  <div className="ml-16">
                    <p className="text-xxs text-accent flex items-center gap-1">
                      선택: {finalCategory}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 표시 설정 섹션 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Palette className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">표시 설정</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 아이콘 */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">아이콘</span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-8 h-8 border border-gray-300 rounded-sm flex items-center justify-center cursor-pointer hover:border-accent transition-colors text-base"
                  >
                    {icon || <span className="text-gray-300 text-xxs">없음</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm text-gray-500 hover:border-accent transition-colors text-left"
                  >
                    {showEmojiPicker ? '닫기' : '이모지 선택...'}
                  </button>
                  {icon && (
                    <button
                      type="button"
                      onClick={() => setIcon('')}
                      className="px-2 py-1 text-xxs text-gray-500 hover:text-red-500"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>
              {/* 이모지 피커 */}
              {showEmojiPicker && (
                <div className="px-2 py-1.5">
                  <div className="ml-16 p-2 border border-gray-200 rounded-sm bg-gray-50 max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-10 gap-1">
                      {EMOJI_LIST.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setIcon(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className={`w-6 h-6 flex items-center justify-center rounded hover:bg-accent/20 transition-colors text-sm ${
                            icon === emoji ? 'bg-accent/30 ring-1 ring-[#fdb813]' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* 고정 여부 */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">고정</span>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  <label htmlFor="isPinned" className="text-xs text-primary-700">
                    상단에 고정
                  </label>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* 푸터 */}
        <div className="px-3 py-2 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-1.5 bg-accent text-primary text-xs font-semibold rounded-sm hover:bg-[#e5a60f] disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
            {editingResource ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceAddModal;
