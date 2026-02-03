import React, { useMemo } from 'react';
import { Resource, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ICONS, CATEGORY_SEPARATOR } from '../../types';
import { Pin, ExternalLink, ChevronRight, ChevronUp, ChevronDown, Trash2, Edit2, Star } from 'lucide-react';

// 정렬 타입
export type SortField = 'title' | 'type' | 'category' | 'createdByName' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

interface ResourceCardProps {
  resource: Resource;
  isSelected: boolean;
  onClick: () => void;
  onTogglePin?: (resource: Resource) => void;
  onEdit?: (resource: Resource) => void;
  onDelete?: (resource: Resource) => void;
  // 다중 선택 관련
  isChecked?: boolean;
  onCheckChange?: (resource: Resource, checked: boolean) => void;
  showCheckbox?: boolean;
  // 즐겨찾기 관련
  isFavorite?: boolean;
  onToggleFavorite?: (resource: Resource) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  isSelected,
  onClick,
  onTogglePin,
  onEdit,
  onDelete,
  isChecked = false,
  onCheckChange,
  showCheckbox = false,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const typeIcon = RESOURCE_TYPE_ICONS[resource.type] || '🔗';
  // 커스텀 타입은 타입명 그대로 표시
  const typeLabel = RESOURCE_TYPE_LABELS[resource.type] || resource.type || '기타';

  // 카테고리 계층 파싱
  const categoryParts = useMemo(() => {
    return resource.category.split(CATEGORY_SEPARATOR).filter(Boolean);
  }, [resource.category]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\. /g, '.').replace(/\.$/, '');
    } catch {
      return '-';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer
        transition-all duration-150 hover:bg-[#fdb813]/5
        ${isSelected ? 'bg-[#fdb813]/10 border-l-4 border-l-[#fdb813]' : 'border-l-4 border-l-transparent'}
      `}
    >
      {/* 체크박스 (다중 선택 모드) */}
      {showCheckbox && (
        <div className="w-5 flex-shrink-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCheckChange?.(resource, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-[#fdb813] focus:ring-[#fdb813] cursor-pointer"
          />
        </div>
      )}

      {/* 고정 핀 */}
      <div className="w-4 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.(resource);
          }}
          className={`p-0.5 rounded transition-colors ${
            resource.isPinned
              ? 'text-[#fdb813] hover:text-[#fdb813]/70'
              : 'text-gray-300 hover:text-[#fdb813]'
          }`}
          title={resource.isPinned ? '고정 해제' : '상단에 고정'}
        >
          <Pin size={12} className={resource.isPinned ? 'fill-[#fdb813]' : ''} />
        </button>
      </div>

      {/* 아이콘 */}
      <div className="w-8 flex-shrink-0 text-center">
        {resource.icon ? (
          <span className="text-lg">{resource.icon}</span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </div>

      {/* 제목 + 설명 */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-[#081429] truncate">
          {resource.title}
        </h3>
        {resource.description && (
          <p className="text-xs text-gray-500 truncate">
            {resource.description}
          </p>
        )}
      </div>

      {/* 타입 */}
      <div className="w-24 flex-shrink-0">
        <span className="text-xxs font-medium px-2 py-0.5 rounded-sm bg-[#081429]/10 text-[#081429] inline-flex items-center gap-1">
          <span>{typeIcon}</span>
          <span>{typeLabel}</span>
        </span>
      </div>

      {/* 카테고리 */}
      <div className="w-40 flex-shrink-0 flex items-center gap-0.5 text-xs text-gray-600">
        {categoryParts.map((part, idx) => (
          <span key={idx} className="flex items-center gap-0.5">
            {idx > 0 && <ChevronRight size={10} className="text-gray-300" />}
            <span className={idx === 0 ? 'font-medium' : ''}>{part}</span>
          </span>
        ))}
      </div>

      {/* 작성자 */}
      <div className="w-20 flex-shrink-0">
        <span className="text-xs text-gray-600 truncate block">
          {resource.createdByName || '-'}
        </span>
      </div>

      {/* 등록일 */}
      <div className="w-24 flex-shrink-0">
        <span className="text-xs text-gray-500">
          {formatDate(resource.createdAt)}
        </span>
      </div>

      {/* 액션 버튼들 */}
      <div className="w-28 flex-shrink-0 flex items-center justify-end gap-1">
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(resource);
            }}
            className={`p-1 transition-colors ${
              isFavorite
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-gray-400 hover:text-yellow-500'
            }`}
            title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star size={14} className={isFavorite ? 'fill-yellow-500' : ''} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(resource);
            }}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
            title="수정"
          >
            <Edit2 size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(resource);
            }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-gray-400 hover:text-[#fdb813] transition-colors"
          title="새 탭에서 열기"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
};

// 테이블 헤더 컴포넌트
interface ResourceTableHeaderProps {
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
  // 다중 선택 관련
  showCheckbox?: boolean;
  isAllChecked?: boolean;
  isIndeterminate?: boolean;
  onToggleAll?: () => void;
}

// 정렬 가능한 헤더 버튼
const SortableHeader: React.FC<{
  field: SortField;
  label: string;
  currentField?: SortField;
  direction?: SortDirection;
  onSort?: (field: SortField) => void;
  className?: string;
}> = ({ field, label, currentField, direction, onSort, className }) => {
  const isActive = currentField === field;

  return (
    <button
      onClick={() => onSort?.(field)}
      className={`flex items-center gap-0.5 hover:text-[#081429] transition-colors ${className || ''} ${isActive ? 'text-[#081429]' : ''}`}
    >
      <span>{label}</span>
      {isActive && (
        direction === 'asc'
          ? <ChevronUp size={12} className="text-[#fdb813]" />
          : <ChevronDown size={12} className="text-[#fdb813]" />
      )}
    </button>
  );
};

export const ResourceTableHeader: React.FC<ResourceTableHeaderProps> = ({
  sortField,
  sortDirection,
  onSort,
  showCheckbox = false,
  isAllChecked = false,
  isIndeterminate = false,
  onToggleAll,
}) => (
  <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 border-b border-gray-200 text-xxs font-bold text-gray-500 uppercase">
    {showCheckbox && (
      <div className="w-5 flex-shrink-0">
        <input
          type="checkbox"
          ref={(el) => {
            if (el) el.indeterminate = isIndeterminate;
          }}
          checked={isAllChecked}
          onChange={onToggleAll}
          className="w-4 h-4 rounded border-gray-300 text-[#fdb813] focus:ring-[#fdb813] cursor-pointer"
        />
      </div>
    )}
    <div className="w-4 flex-shrink-0" />
    <div className="w-8 flex-shrink-0 text-center">아이콘</div>
    <div className="flex-1 min-w-0">
      <SortableHeader field="title" label="제목" currentField={sortField} direction={sortDirection} onSort={onSort} />
    </div>
    <div className="w-24 flex-shrink-0">
      <SortableHeader field="type" label="타입" currentField={sortField} direction={sortDirection} onSort={onSort} />
    </div>
    <div className="w-40 flex-shrink-0">
      <SortableHeader field="category" label="카테고리" currentField={sortField} direction={sortDirection} onSort={onSort} />
    </div>
    <div className="w-20 flex-shrink-0">
      <SortableHeader field="createdByName" label="작성자" currentField={sortField} direction={sortDirection} onSort={onSort} />
    </div>
    <div className="w-24 flex-shrink-0">
      <SortableHeader field="createdAt" label="등록일" currentField={sortField} direction={sortDirection} onSort={onSort} />
    </div>
    <div className="w-28 flex-shrink-0 text-right">작업</div>
  </div>
);

export default ResourceCard;
