import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Loader2, Image as ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
// html-to-image는 동적 import로 로드 (한글 폰트 렌더링이 html2canvas보다 우수)

interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRef: React.RefObject<HTMLElement>;
  title: string;
  subtitle?: string;
  fileName: string;
}

const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  targetRef,
  title,
  subtitle,
  fileName
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(50); // 기본 50% 축소 미리보기
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

      // 스크롤 위치 저장
      const scrollContainer = targetRef.current.closest('.overflow-auto');
      const originalScrollLeft = scrollContainer?.scrollLeft || 0;
      const originalScrollTop = scrollContainer?.scrollTop || 0;

      // 스크롤 초기화 (전체 캡처를 위해)
      if (scrollContainer) {
        scrollContainer.scrollLeft = 0;
        scrollContainer.scrollTop = 0;
      }

      // 잠시 대기 (스크롤 적용)
      await new Promise(resolve => setTimeout(resolve, 50));

      // html-to-image로 JPEG 생성 (PNG보다 빠름)
      const dataUrl = await toJpeg(targetRef.current, {
        quality: 0.92, // JPEG 품질 (0.92 = 좋은 품질)
        pixelRatio: 1, // 속도 최적화 (1.5 -> 1)
        backgroundColor: '#ffffff',
        skipFonts: true, // 폰트 임베딩 스킵 (속도 향상)
      });

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

  // 모달이 열릴 때 이미지 생성
  useEffect(() => {
    if (isOpen && targetRef.current) {
      generatePreview();
    }
    return () => {
      // 모달 닫힐 때 정리
      if (!isOpen) {
        setPreviewImage(null);
        setError(null);
        setZoom(50);
      }
    };
  }, [isOpen, generatePreview]);

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ImageIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

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
              <div className="p-4 bg-red-100 rounded-full">
                <X size={32} className="text-red-500" />
              </div>
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={generatePreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : previewImage ? (
            <div
              ref={previewContainerRef}
              className="h-full overflow-auto bg-gray-200 rounded-lg p-4"
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 20 || !previewImage}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="확대"
            >
              <ZoomIn size={18} className="text-gray-600" />
            </button>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              취소
            </button>
            <button
              onClick={handleDownload}
              disabled={!previewImage || isGenerating}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Download size={18} />
              이미지 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportImageModal;
