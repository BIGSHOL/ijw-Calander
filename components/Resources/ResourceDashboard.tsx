import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Resource, UserProfile, RESOURCE_CATEGORY_TREE, CATEGORY_SEPARATOR } from '../../types';
import { useResources, useCreateResource, useUpdateResource, useDeleteResource } from '../../hooks/useResources';
import { VideoLoading } from '../Common/VideoLoading';
import ResourceCard, { ResourceTableHeader, SortField, SortDirection } from './ResourceCard';
import ResourceAddModal from './ResourceAddModal';
import { FolderOpen, Folder, Plus, Loader2, RefreshCw, Home, ChevronRight, Search, X, Clock, Trash2, CheckSquare, Star, RotateCcw, GripVertical } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import { usePermissions } from '../../hooks/usePermissions';

interface ResourceDashboardProps {
  userProfile: UserProfile | null;
}

const ResourceDashboard: React.FC<ResourceDashboardProps> = ({ userProfile }) => {
  const { data: resources = [], isLoading, refetch } = useResources();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const deleteResource = useDeleteResource();

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  // 폴더 탐색 상태
  const [currentMain, setCurrentMain] = useState<string | null>(null);
  const [currentSub, setCurrentSub] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 정렬 상태
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  // 즐겨찾기 상태 (로컬스토리지에서 로드)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = storage.getJSON<string[]>(STORAGE_KEYS.RESOURCE_FAVORITES, []);
    return new Set(saved);
  });
  // 즐겨찾기 필터 상태
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  // 카테고리 순서 (로컬스토리지에서 로드)
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    return storage.getJSON<string[]>(STORAGE_KEYS.RESOURCE_CATEGORY_ORDER, []);
  });
  // 드래그 상태
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedSubCategory, setDraggedSubCategory] = useState<string | null>(null);
  // 중분류 순서 (대분류별로 로컬스토리지에서 로드)
  const [subCategoryOrders, setSubCategoryOrders] = useState<Record<string, string[]>>({});

  // 대분류 선택 시 해당 중분류 순서 로드
  useEffect(() => {
    if (currentMain) {
      const savedOrder = storage.getJSON<string[]>(
        STORAGE_KEYS.resourceSubCategoryOrder(currentMain),
        []
      );
      if (savedOrder.length > 0) {
        setSubCategoryOrders(prev => ({
          ...prev,
          [currentMain]: savedOrder,
        }));
      }
    }
  }, [currentMain]);

  // 리소스 편집 권한
  const { hasPermission } = usePermissions(userProfile ?? null);
  const canEdit = hasPermission('resources.edit');

  // 기존 카테고리 추출 (모달에 전달용)
  const existingCategories = useMemo(() => {
    const categories = new Set(resources.map(r => r.category));
    return Array.from(categories);
  }, [resources]);

  // 대분류 목록 (기본 + 리소스에서 추출 + 정렬)
  const mainCategories = useMemo(() => {
    const defaultMains = Object.keys(RESOURCE_CATEGORY_TREE);
    const resourceMains = new Set(resources.map(r => {
      const parts = r.category.split(CATEGORY_SEPARATOR);
      return parts[0] || '기타';
    }));
    const allCategories = Array.from(new Set([...defaultMains, ...resourceMains]));

    // 정렬 로직: 저장된 순서 우선, 없으면 가나다 순 (기타는 맨 끝)
    if (categoryOrder.length > 0) {
      // 저장된 순서대로 정렬
      const ordered: string[] = [];
      const remaining: string[] = [];

      // 저장된 순서에 있는 것들 먼저
      categoryOrder.forEach(cat => {
        if (allCategories.includes(cat)) {
          ordered.push(cat);
        }
      });

      // 저장된 순서에 없는 새로운 카테고리들 (가나다 순, 기타 제외)
      allCategories.forEach(cat => {
        if (!ordered.includes(cat) && cat !== '기타') {
          remaining.push(cat);
        }
      });
      remaining.sort((a, b) => a.localeCompare(b, 'ko'));

      // 기타는 항상 맨 끝
      const result = [...ordered, ...remaining];
      if (allCategories.includes('기타') && !result.includes('기타')) {
        result.push('기타');
      }
      return result;
    }

    // 기본: 가나다 순 (기타는 맨 끝)
    const sorted = allCategories.filter(c => c !== '기타').sort((a, b) => a.localeCompare(b, 'ko'));
    if (allCategories.includes('기타')) {
      sorted.push('기타');
    }
    return sorted;
  }, [resources, categoryOrder]);

  // 중분류 목록 (선택된 대분류 기준 + 정렬)
  const subCategories = useMemo(() => {
    if (!currentMain) return [];

    // 기본 트리에서
    const defaultSubs = RESOURCE_CATEGORY_TREE[currentMain]
      ? Object.keys(RESOURCE_CATEGORY_TREE[currentMain])
      : [];

    // 리소스에서 추출
    const resourceSubs = new Set(
      resources
        .filter(r => r.category.startsWith(currentMain + CATEGORY_SEPARATOR) || r.category === currentMain)
        .map(r => {
          const parts = r.category.split(CATEGORY_SEPARATOR);
          return parts[1] || '';
        })
        .filter(Boolean)
    );

    const allSubs = Array.from(new Set([...defaultSubs, ...resourceSubs]));

    // 정렬 로직: 저장된 순서 우선, 없으면 가나다 순 (기타는 맨 끝)
    const savedOrder = subCategoryOrders[currentMain] || [];
    if (savedOrder.length > 0) {
      const ordered: string[] = [];
      const remaining: string[] = [];

      // 저장된 순서에 있는 것들 먼저
      savedOrder.forEach(sub => {
        if (allSubs.includes(sub)) {
          ordered.push(sub);
        }
      });

      // 저장된 순서에 없는 새로운 카테고리들 (가나다 순, 기타 제외)
      allSubs.forEach(sub => {
        if (!ordered.includes(sub) && sub !== '기타') {
          remaining.push(sub);
        }
      });
      remaining.sort((a, b) => a.localeCompare(b, 'ko'));

      // 기타는 항상 맨 끝
      const result = [...ordered, ...remaining];
      if (allSubs.includes('기타') && !result.includes('기타')) {
        result.push('기타');
      }
      return result;
    }

    // 기본: 가나다 순 (기타는 맨 끝)
    const sorted = allSubs.filter(s => s !== '기타').sort((a, b) => a.localeCompare(b, 'ko'));
    if (allSubs.includes('기타')) {
      sorted.push('기타');
    }
    return sorted;
  }, [currentMain, resources, subCategoryOrders]);

  // 현재 경로의 리소스 (필터링 + 검색 + 정렬)
  const currentResources = useMemo(() => {
    let filtered = resources;

    // 카테고리 필터
    if (currentMain) {
      filtered = filtered.filter(r => {
        const parts = r.category.split(CATEGORY_SEPARATOR);
        const resourceMain = parts[0] || '';
        const resourceSub = parts[1] || '';

        if (resourceMain !== currentMain) return false;
        if (currentSub && resourceSub !== currentSub) return false;

        return true;
      });
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        (r.description?.toLowerCase().includes(query)) ||
        r.url.toLowerCase().includes(query) ||
        (r.createdByName?.toLowerCase().includes(query)) ||
        r.category.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query)
      );
    }

    // 즐겨찾기 필터
    if (showOnlyFavorites) {
      filtered = filtered.filter(r => favorites.has(r.id));
    }

    // 정렬 적용
    if (sortField) {
      const sorted = [...filtered].sort((a, b) => {
        let aVal: string;
        let bVal: string;

        switch (sortField) {
          case 'title':
            aVal = a.title || '';
            bVal = b.title || '';
            break;
          case 'type':
            aVal = a.type || '';
            bVal = b.type || '';
            break;
          case 'category':
            aVal = a.category || '';
            bVal = b.category || '';
            break;
          case 'createdByName':
            aVal = a.createdByName || '';
            bVal = b.createdByName || '';
            break;
          case 'createdAt':
            aVal = a.createdAt || '';
            bVal = b.createdAt || '';
            break;
          default:
            return 0;
        }

        const cmp = aVal.localeCompare(bVal, 'ko');
        return sortDirection === 'asc' ? cmp : -cmp;
      });

      // 고정된 항목은 항상 맨 위에
      const pinned = sorted.filter(r => r.isPinned);
      const unpinned = sorted.filter(r => !r.isPinned);
      return [...pinned, ...unpinned];
    }

    return filtered;
  }, [resources, currentMain, currentSub, searchQuery, showOnlyFavorites, favorites, sortField, sortDirection]);

  // 정렬 핸들러
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // 같은 필드 클릭 시 방향 토글
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // 새 필드 선택 시 오름차순으로 시작
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // 고정 토글 핸들러
  const handleTogglePin = useCallback(async (resource: Resource) => {
    try {
      await updateResource.mutateAsync({
        id: resource.id,
        updates: { isPinned: !resource.isPinned },
      });
    } catch (error) {
      console.error('고정 토글 실패:', error);
    }
  }, [updateResource]);

  // 다중 선택 관련 핸들러
  const handleCheckChange = useCallback((resource: Resource, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(resource.id);
      } else {
        newSet.delete(resource.id);
      }
      return newSet;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === currentResources.length) {
      // 모두 선택됨 -> 모두 해제
      setSelectedIds(new Set());
    } else {
      // 일부 또는 없음 -> 모두 선택
      setSelectedIds(new Set(currentResources.map(r => r.id)));
    }
  }, [currentResources, selectedIds.size]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`선택한 ${selectedIds.size}개의 리소스를 삭제하시겠습니까?`)) return;

    try {
      // 순차적으로 삭제
      for (const id of selectedIds) {
        await deleteResource.mutateAsync(id);
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('일부 리소스 삭제에 실패했습니다.');
    }
  }, [selectedIds, deleteResource]);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  // 즐겨찾기 토글 핸들러
  const handleToggleFavorite = useCallback((resource: Resource) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resource.id)) {
        newSet.delete(resource.id);
      } else {
        newSet.add(resource.id);
      }
      // 로컬스토리지에 저장
      storage.setJSON(STORAGE_KEYS.RESOURCE_FAVORITES, Array.from(newSet));
      return newSet;
    });
  }, []);

  // 카테고리 드래그 핸들러
  const handleDragStart = useCallback((category: string) => {
    setDraggedCategory(category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;
  }, [draggedCategory]);

  const handleDrop = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;

    // 새로운 순서 계산
    const newOrder = [...mainCategories];
    const dragIndex = newOrder.indexOf(draggedCategory);
    const dropIndex = newOrder.indexOf(targetCategory);

    if (dragIndex !== -1 && dropIndex !== -1) {
      newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, draggedCategory);

      // 저장
      setCategoryOrder(newOrder);
      storage.setJSON(STORAGE_KEYS.RESOURCE_CATEGORY_ORDER, newOrder);
    }

    setDraggedCategory(null);
  }, [draggedCategory, mainCategories]);

  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
  }, []);

  // 카테고리 순서 초기화
  const handleResetCategoryOrder = useCallback(() => {
    setCategoryOrder([]);
    storage.remove(STORAGE_KEYS.RESOURCE_CATEGORY_ORDER);
  }, []);

  // 중분류 드래그 핸들러
  const handleSubDragStart = useCallback((subCategory: string) => {
    setDraggedSubCategory(subCategory);
  }, []);

  const handleSubDragOver = useCallback((e: React.DragEvent, targetSub: string) => {
    e.preventDefault();
    if (!draggedSubCategory || draggedSubCategory === targetSub) return;
  }, [draggedSubCategory]);

  const handleSubDrop = useCallback((e: React.DragEvent, targetSub: string) => {
    e.preventDefault();
    if (!draggedSubCategory || draggedSubCategory === targetSub || !currentMain) return;

    // 새로운 순서 계산
    const newOrder = [...subCategories];
    const dragIndex = newOrder.indexOf(draggedSubCategory);
    const dropIndex = newOrder.indexOf(targetSub);

    if (dragIndex !== -1 && dropIndex !== -1) {
      newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, draggedSubCategory);

      // 저장
      setSubCategoryOrders(prev => ({
        ...prev,
        [currentMain]: newOrder,
      }));
      storage.setJSON(STORAGE_KEYS.resourceSubCategoryOrder(currentMain), newOrder);
    }

    setDraggedSubCategory(null);
  }, [draggedSubCategory, subCategories, currentMain]);

  const handleSubDragEnd = useCallback(() => {
    setDraggedSubCategory(null);
  }, []);

  // 중분류 순서 초기화
  const handleResetSubCategoryOrder = useCallback(() => {
    if (!currentMain) return;
    setSubCategoryOrders(prev => {
      const newOrders = { ...prev };
      delete newOrders[currentMain];
      return newOrders;
    });
    storage.remove(STORAGE_KEYS.resourceSubCategoryOrder(currentMain));
  }, [currentMain]);

  // 전체 선택 상태 계산
  const isAllChecked = currentResources.length > 0 && selectedIds.size === currentResources.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < currentResources.length;

  // 각 대분류별 리소스 개수
  const mainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    resources.forEach(r => {
      const main = r.category.split(CATEGORY_SEPARATOR)[0] || '기타';
      counts[main] = (counts[main] || 0) + 1;
    });
    return counts;
  }, [resources]);

  // 최근 추가 리소스 (최신 5개)
  const recentResources = useMemo(() => {
    return [...resources]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [resources]);

  // 각 중분류별 리소스 개수
  const subCounts = useMemo(() => {
    if (!currentMain) return {};
    const counts: Record<string, number> = {};
    resources.forEach(r => {
      const parts = r.category.split(CATEGORY_SEPARATOR);
      if (parts[0] === currentMain && parts[1]) {
        counts[parts[1]] = (counts[parts[1]] || 0) + 1;
      }
    });
    return counts;
  }, [resources, currentMain]);

  // 리소스 생성/수정
  const handleSubmit = async (data: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingResource) {
      await updateResource.mutateAsync({
        id: editingResource.id,
        updates: data,
      });
    } else {
      await createResource.mutateAsync(data);
    }
  };

  // 리소스 삭제
  const handleDelete = async (resource: Resource) => {
    if (!confirm(`"${resource.title}" 리소스를 삭제하시겠습니까?`)) return;

    try {
      await deleteResource.mutateAsync(resource.id);
      if (selectedResource?.id === resource.id) {
        setSelectedResource(null);
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 수정 모달 열기
  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setIsAddModalOpen(true);
  };

  // 새로고침
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // 폴더 클릭 핸들러
  const handleMainClick = (main: string) => {
    setCurrentMain(main);
    setCurrentSub(null);
    setSelectedResource(null);
  };

  const handleSubClick = (sub: string) => {
    setCurrentSub(sub);
    setSelectedResource(null);
  };

  const handleHomeClick = () => {
    setCurrentMain(null);
    setCurrentSub(null);
    setSelectedResource(null);
  };

  if (isLoading) {
    return (
      <VideoLoading className="flex-1 h-full" />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="bg-primary px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-accent" />
            <h1 className="text-sm font-bold text-white">자료실</h1>
          </div>

          {/* 브레드크럼 네비게이션 */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={handleHomeClick}
              className={`px-2 py-1 rounded transition-colors ${
                !currentMain ? 'bg-accent text-primary font-bold' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Home size={14} />
            </button>
            {currentMain && (
              <>
                <ChevronRight size={14} className="text-gray-500" />
                <button
                  onClick={() => { setCurrentSub(null); setSelectedResource(null); }}
                  className={`px-2 py-1 rounded transition-colors ${
                    !currentSub ? 'bg-accent text-primary font-bold' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {currentMain}
                </button>
              </>
            )}
            {currentSub && (
              <>
                <ChevronRight size={14} className="text-gray-500" />
                <span className="px-2 py-1 bg-accent text-primary font-bold rounded">
                  {currentSub}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="w-48 pl-9 pr-8 py-1.5 bg-white/10 border border-white/20 rounded-sm text-xs text-white placeholder-gray-400 focus:bg-white/20 focus:border-accent focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 즐겨찾기 필터 */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`p-2 transition-colors ${
              showOnlyFavorites
                ? 'text-yellow-500 hover:text-yellow-400'
                : 'text-gray-400 hover:text-white'
            }`}
            title={showOnlyFavorites ? '전체 보기' : '즐겨찾기만 보기'}
          >
            <Star size={14} className={showOnlyFavorites ? 'fill-yellow-500' : ''} />
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="새로고침"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* 다중 선택 모드 버튼들 */}
          {canEdit && (
            <>
              {isSelectionMode ? (
                <>
                  <span className="text-xs text-gray-400">
                    {selectedIds.size}개 선택됨
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-sm text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                    삭제
                  </button>
                  <button
                    onClick={handleCancelSelection}
                    className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-xs"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="다중 선택"
                >
                  <CheckSquare size={14} />
                </button>
              )}
            </>
          )}

          {canEdit && !isSelectionMode && (
            <button
              onClick={() => {
                setEditingResource(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-primary rounded-sm text-xs font-bold hover:bg-accent/90 transition-colors"
            >
              <Plus size={14} />
              추가
            </button>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 1단: 대분류 폴더 (홈일 때만) */}
        {!currentMain && (
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xxs text-gray-400">드래그하여 순서 변경</span>
              {categoryOrder.length > 0 && (
                <button
                  onClick={handleResetCategoryOrder}
                  className="flex items-center gap-1 text-xxs text-gray-400 hover:text-accent transition-colors"
                  title="가나다 순으로 초기화"
                >
                  <RotateCcw size={10} />
                  순서 초기화
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {mainCategories.map(main => (
                <div
                  key={main}
                  draggable
                  onDragStart={() => handleDragStart(main)}
                  onDragOver={(e) => handleDragOver(e, main)}
                  onDrop={(e) => handleDrop(e, main)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleMainClick(main)}
                  className={`flex flex-col items-center gap-2 p-4 min-w-[100px] rounded-sm border-2 cursor-pointer transition-all group ${
                    draggedCategory === main
                      ? 'border-accent opacity-50'
                      : 'border-gray-200 hover:border-accent hover:bg-accent/5'
                  }`}
                >
                  <div className="relative">
                    <GripVertical size={12} className="absolute -left-5 top-2 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                    <Folder size={32} className="text-accent group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-xs font-bold text-primary">{main}</span>
                  {mainCounts[main] > 0 && (
                    <span className="text-xxs text-gray-500">{mainCounts[main]}개</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 최근 추가 리소스 (홈일 때만) */}
        {!currentMain && recentResources.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock size={12} className="text-accent" />
                <span className="text-xxs font-bold text-gray-400">최근</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto">
                {recentResources.map(resource => (
                  <button
                    key={resource.id}
                    onClick={() => {
                      const parts = resource.category.split(CATEGORY_SEPARATOR);
                      if (parts[0]) setCurrentMain(parts[0]);
                      if (parts[1]) setCurrentSub(parts[1]);
                      setSelectedResource(resource);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-gray-100 transition-colors shrink-0 group"
                  >
                    <span className="text-xs">{resource.icon || '📄'}</span>
                    <span className="text-xxs font-medium text-primary group-hover:text-accent truncate max-w-[120px]">{resource.title}</span>
                    <span className="text-xxs text-gray-300">{resource.createdAt?.slice(2, 10).replace(/-/g, '.')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2단: 중분류 폴더 (대분류 선택 시) */}
        {currentMain && !currentSub && subCategories.length > 0 && (
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xxs text-gray-400">드래그하여 순서 변경</span>
              {subCategoryOrders[currentMain]?.length > 0 && (
                <button
                  onClick={handleResetSubCategoryOrder}
                  className="flex items-center gap-1 text-xxs text-gray-400 hover:text-primary transition-colors"
                  title="가나다 순으로 초기화"
                >
                  <RotateCcw size={10} />
                  순서 초기화
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {subCategories.map(sub => (
                <div
                  key={sub}
                  draggable
                  onDragStart={() => handleSubDragStart(sub)}
                  onDragOver={(e) => handleSubDragOver(e, sub)}
                  onDrop={(e) => handleSubDrop(e, sub)}
                  onDragEnd={handleSubDragEnd}
                  onClick={() => handleSubClick(sub)}
                  className={`flex flex-col items-center gap-2 p-3 min-w-[90px] rounded-sm border-2 cursor-pointer transition-all group ${
                    draggedSubCategory === sub
                      ? 'border-primary opacity-50'
                      : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <div className="relative">
                    <GripVertical size={10} className="absolute -left-4 top-1.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                    <Folder size={28} className="text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-xs font-medium text-primary">{sub}</span>
                  {subCounts[sub] > 0 && (
                    <span className="text-xxs text-gray-500">{subCounts[sub]}개</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3단: 카드 그리드 + 미리보기 */}
        <div className="flex-1 overflow-hidden p-4">
          {currentResources.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">
                  {currentMain
                    ? `"${currentMain}${currentSub ? ` > ${currentSub}` : ''}" 폴더가 비어있습니다`
                    : '등록된 리소스가 없습니다'}
                </p>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingResource(null);
                      setIsAddModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={14} />
                    리소스 추가하기
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              {/* 리소스 테이블 */}
              <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
                <ResourceTableHeader
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  showCheckbox={isSelectionMode}
                  isAllChecked={isAllChecked}
                  isIndeterminate={isIndeterminate}
                  onToggleAll={handleToggleAll}
                />
                <div className="divide-y divide-gray-100">
                  {currentResources.map(resource => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      isSelected={selectedResource?.id === resource.id}
                      onClick={() => setSelectedResource(resource)}
                      onTogglePin={canEdit ? handleTogglePin : undefined}
                      onEdit={canEdit ? handleEdit : undefined}
                      onDelete={canEdit ? handleDelete : undefined}
                      showCheckbox={isSelectionMode}
                      isChecked={selectedIds.has(resource.id)}
                      onCheckChange={handleCheckChange}
                      isFavorite={favorites.has(resource.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 */}
      <ResourceAddModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingResource(null);
        }}
        onSubmit={handleSubmit}
        editingResource={editingResource}
        existingCategories={existingCategories}
        existingUrls={resources.map(r => r.url)}
        currentUserName={userProfile?.displayName || userProfile?.email || ''}
        currentUserId={userProfile?.uid || ''}
      />
    </div>
  );
};

export default ResourceDashboard;
