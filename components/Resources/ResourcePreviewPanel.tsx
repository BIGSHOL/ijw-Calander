import React from 'react';
import { Resource, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ICONS, CATEGORY_SEPARATOR } from '../../types';
import { ExternalLink, Edit2, Trash2, Link2, Calendar, User, Tag, ChevronRight } from 'lucide-react';

interface ResourcePreviewPanelProps {
  resource: Resource | null;
  canEdit: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
}

const ResourcePreviewPanel: React.FC<ResourcePreviewPanelProps> = ({
  resource,
  canEdit,
  onEdit,
  onDelete,
}) => {
  if (!resource) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center text-gray-400">
          <Link2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">리소스를 선택하세요</p>
        </div>
      </div>
    );
  }

  const typeIcon = RESOURCE_TYPE_ICONS[resource.type] || '🔗';
  // 커스텀 타입은 타입명 그대로 표시
  const typeLabel = RESOURCE_TYPE_LABELS[resource.type] || resource.type || '기타';
  const categoryParts = resource.category.split(CATEGORY_SEPARATOR).filter(Boolean);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 bg-[#081429]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{resource.icon || typeIcon}</span>
            <div>
              <h3 className="text-sm font-bold text-white">{resource.title}</h3>
              <span className="text-[10px] text-gray-400">{typeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(resource)}
                  className="p-1.5 text-gray-400 hover:text-[#fdb813] rounded transition-colors"
                  title="수정"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDelete(resource)}
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded transition-colors"
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-[#fdb813] rounded transition-colors"
              title="새 탭에서 열기"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* 본문 - 아이콘 + 정보 */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 대형 아이콘 */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-2xl bg-[#081429]/5 flex items-center justify-center">
            <span className="text-5xl">{resource.icon || typeIcon}</span>
          </div>
        </div>

        {/* 제목 */}
        <h2 className="text-lg font-bold text-[#081429] text-center mb-2">
          {resource.title}
        </h2>

        {/* 타입 배지 */}
        <div className="flex justify-center mb-4">
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#fdb813]/20 text-[#081429]">
            {typeIcon} {typeLabel}
          </span>
        </div>

        {/* 설명 */}
        {resource.description && (
          <p className="text-sm text-gray-600 text-center mb-6 px-4">
            {resource.description}
          </p>
        )}

        {/* 정보 카드 */}
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          {/* 카테고리 */}
          <div className="flex items-start gap-3">
            <Tag size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">카테고리</p>
              <div className="flex items-center gap-1 text-sm text-[#081429]">
                {categoryParts.map((part, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight size={12} className="text-gray-300" />}
                    <span className={idx === 0 ? 'font-medium' : ''}>{part}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 작성자 */}
          <div className="flex items-start gap-3">
            <User size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">작성자</p>
              <p className="text-sm text-[#081429]">{resource.createdByName || '-'}</p>
            </div>
          </div>

          {/* 등록일 */}
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">등록일</p>
              <p className="text-sm text-[#081429]">{formatDate(resource.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* 바로가기 버튼 */}
        <div className="mt-6">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#081429] text-white rounded-xl text-sm font-medium hover:bg-[#081429]/90 transition-colors"
          >
            <ExternalLink size={16} />
            새 탭에서 열기
          </a>
        </div>
      </div>

      {/* URL 표시 */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-[10px] text-gray-400 truncate font-mono">{resource.url}</p>
      </div>
    </div>
  );
};

export default ResourcePreviewPanel;
