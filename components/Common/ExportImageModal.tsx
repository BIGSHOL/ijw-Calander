import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Loader2, Image as ImageIcon, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';
// html-to-image는 동적 import로 로드 (한글 폰트 렌더링이 html2canvas보다 우수)

// 그룹 정보 인터페이스 (행 선택용)
export interface ExportGroup {
  id: string | number;
  label: string;
}

interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRef: React.RefObject<HTMLElement>;
  title: string;
  subtitle?: string;
  fileName: string;
  // 행 선택 기능용 props
  groups?: ExportGroup[];
  onGroupsChanged?: (selectedIds: (string | number)[]) => void;
}

const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  targetRef,
  title,
  subtitle,
  fileName,
  groups,
  onGroupsChanged,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(50); // 기본 50% 축소 미리보기
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // 그룹 선택 상태 (groups prop이 있을 때만 사용)
  const [selectedGroups, setSelectedGroups] = useState<Set<string | number>>(new Set());
  const [showSelectionStep, setShowSelectionStep] = useState(true);

  // groups의 ID들을 문자열로 변환하여 비교 (배열 참조 변경 시 불필요한 재실행 방지)
  const groupIdsKey = groups?.map(g => g.id).join(',') ?? '';

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      // 그룹이 있으면 모두 선택된 상태로 시작
      if (groups && groups.length > 0) {
        setSelectedGroups(new Set(groups.map(g => g.id)));
        setShowSelectionStep(true);
        setPreviewImage(null);
      } else {
        // 그룹 없으면 바로 미리보기 생성
        setShowSelectionStep(false);
      }
    }
    return () => {
      if (!isOpen) {
        setPreviewImage(null);
        setError(null);
        setZoom(50);
        setShowSelectionStep(true);
        setSelectedGroups(new Set());
      }
    };
  }, [isOpen, groupIdsKey]); // groups 대신 groupIdsKey 사용

  // 그룹 없이 열릴 때 자동 미리보기 생성
  useEffect(() => {
    if (isOpen && !groupIdsKey && targetRef.current) {
      generatePreview();
    }
  }, [isOpen, groupIdsKey]);

  // 그룹 선택 토글
  const toggleGroup = (groupId: string | number) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (groups) {
      if (selectedGroups.size === groups.length) {
        setSelectedGroups(new Set());
      } else {
        setSelectedGroups(new Set(groups.map(g => g.id)));
      }
    }
  };

  // 선택 완료 후 미리보기 생성
  const handleSelectionConfirm = async () => {
    if (selectedGroups.size === 0) {
      setError('최소 1개 이상의 행을 선택해주세요.');
      return;
    }

    // 부모에게 선택된 그룹 알림 (DOM 업데이트용)
    if (onGroupsChanged) {
      onGroupsChanged(Array.from(selectedGroups));
    }

    setShowSelectionStep(false);

    // DOM 업데이트 대기 후 미리보기 생성
    await new Promise(resolve => setTimeout(resolve, 100));
    await generatePreview();
  };

  // 선택 단계로 돌아가기
  const handleBackToSelection = () => {
    setShowSelectionStep(true);
    setPreviewImage(null);
    setError(null);

    // 모든 그룹 다시 표시
    if (onGroupsChanged && groups) {
      onGroupsChanged(groups.map(g => g.id));
    }
  };

  // html2canvas 동적 로드 및 이미지 생성 (bundle-dynamic-imports)
  const generatePreview = useCallback(async () => {
    if (!targetRef.current) {
      setError('캡처할 요소를 찾을 수 없습니다.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // html-to-image 동적 import (한글 폰트 렌더링이 html2canvas보다 우수)
      const { toJpeg } = await import('html-to-image');

      // 타겟 요소와 스크롤 컨테이너 찾기
      const target = targetRef.current;
      const scrollContainer = target.closest('.overflow-auto') || target.querySelector('.overflow-auto');

      // 스크롤 위치 저장
      const originalScrollLeft = scrollContainer?.scrollLeft || 0;
      const originalScrollTop = scrollContainer?.scrollTop || 0;

      // 원본 스타일 저장 (전체 캡처를 위해 일시적으로 overflow 변경)
      const originalOverflow = target.style.overflow;
      const originalMaxHeight = target.style.maxHeight;
      const originalHeight = target.style.height;

      // 스크롤 초기화
      if (scrollContainer) {
        scrollContainer.scrollLeft = 0;
        scrollContainer.scrollTop = 0;
      }

      // 전체 콘텐츠를 캡처하기 위해 overflow 임시 해제
      target.style.overflow = 'visible';
      target.style.maxHeight = 'none';
      target.style.height = 'auto';

      // 잠시 대기 (스타일 적용)
      await new Promise(resolve => setTimeout(resolve, 100));

      // html-to-image로 JPEG 생성 (PNG보다 빠름)
      const dataUrl = await toJpeg(target, {
        quality: 0.92, // JPEG 품질 (0.92 = 좋은 품질)
        pixelRatio: 1.5, // 선명도를 위해 1.5로 증가
        backgroundColor: '#ffffff',
        skipFonts: true, // 폰트 임베딩 스킵 (속도 향상)
        // 전체 영역 캡처 설정
        width: target.scrollWidth,
        height: target.scrollHeight,
      });

      // 원본 스타일 복원
      target.style.overflow = originalOverflow;
      target.style.maxHeight = originalMaxHeight;
      target.style.height = originalHeight;

      // 스크롤 위치 복원
      if (scrollContainer) {
        scrollContainer.scrollLeft = originalScrollLeft;
        scrollContainer.scrollTop = originalScrollTop;
      }

      setPreviewImage(dataUrl);
    } catch (err) {
      console.error('이미지 생성 실패:', err);
      setError('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [targetRef]);

  const handleDownload = () => {
    if (!previewImage) return;

    const link = document.createElement('a');
    link.href = previewImage;
    link.download = fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 다운로드 후 모달 닫기
    onClose();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 20));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-sm shadow-xl w-[95vw] max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-sm">
              <ImageIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary">{title}</h2>
              {subtitle && (
                <p className="text-xs text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 그룹 선택 단계 */}
        {groups && showSelectionStep ? (
          <>
            <div className="flex-1 min-h-0 p-4 bg-gray-50 overflow-auto">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">저장할 행(그룹)을 선택하세요:</p>

                {/* 전체 선택/해제 버튼 */}
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 px-3 py-1.5 mb-3 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
                >
                  {selectedGroups.size === groups.length ? (
                    <>전체 해제</>
                  ) : (
                    <>전체 선택</>
                  )}
                </button>

                {/* 그룹 체크박스 목록 */}
                <div className="space-y-2">
                  {groups.map(group => (
                    <label
                      key={group.id}
                      className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer transition-colors ${
                        selectedGroups.has(group.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 flex items-center justify-center border-2 rounded-sm transition-colors ${
                        selectedGroups.has(group.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedGroups.has(group.id) && (
                          <Check size={14} className="text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{group.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-sm">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* 선택 단계 푸터 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white shrink-0">
              <div className="text-sm text-gray-500">
                {selectedGroups.size}개 선택됨
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleSelectionConfirm}
                  disabled={selectedGroups.size === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  미리보기 생성
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 미리보기 영역 */}
            <div className="flex-1 min-h-0 p-4 bg-gray-50 overflow-hidden">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 size={48} className="text-blue-500 animate-spin" />
                  <p className="text-gray-600 font-medium">이미지 생성 중...</p>
                  <p className="text-sm text-gray-400">크기에 따라 시간이 걸릴 수 있습니다</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="p-4 bg-red-100 rounded-sm">
                    <X size={32} className="text-red-500" />
                  </div>
                  <p className="text-red-600 font-medium">{error}</p>
                  <button
                    onClick={generatePreview}
                    className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              ) : previewImage ? (
                <div
                  ref={previewContainerRef}
                  className="h-full overflow-auto bg-gray-200 rounded-sm p-4"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                  }}
                >
                  <img
                    src={previewImage}
                    alt="미리보기"
                    className="mx-auto shadow-lg rounded border border-gray-300"
                    style={{
                      width: `${zoom}%`,
                      maxWidth: 'none',
                      height: 'auto'
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* 푸터 (컨트롤) */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-sm shrink-0">
              {/* 줌 컨트롤 + 선택으로 돌아가기 */}
              <div className="flex items-center gap-4">
                {groups && (
                  <button
                    onClick={handleBackToSelection}
                    disabled={isGenerating}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    행 다시 선택
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 20 || !previewImage}
                    className="p-2 rounded-sm border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="축소"
                  >
                    <ZoomOut size={18} className="text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600 min-w-[50px] text-center font-medium">
                    {zoom}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 100 || !previewImage}
                    className="p-2 rounded-sm border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="확대"
                  >
                    <ZoomIn size={18} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!previewImage || isGenerating}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Download size={18} />
                  이미지 저장
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExportImageModal;
