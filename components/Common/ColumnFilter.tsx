import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  values: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (dir: 'asc' | 'desc') => void;
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** 필터 드롭다운 내 값 목록의 정렬 비교 함수. 미지정 시 한글 localeCompare. */
  sortFn?: (a: string, b: string) => number;
}

/**
 * 컬럼 헤더용 필터 + 정렬 통합 컴포넌트
 * - 헤더 클릭 → 드롭다운: 정렬(오름/내림) + 값별 체크박스 필터
 * - 표시 텍스트(children) + 정렬 표시(▲/▼) + 필터 활성 표시(파란 점)
 * - 빈 selected = 전체 선택, NONE_SENTINEL만 있으면 전체 해제
 */
export const ColumnFilter: React.FC<Props> = ({
  values,
  selected,
  onChange,
  sortKey,
  sortDir,
  onSort,
  children,
  align = 'left',
  sortFn,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 위치 — viewport 좌표 (fixed). 부모 overflow 클립 회피용 portal 렌더링.
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    if (align === 'right') {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    } else {
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open, align]);

  // 외부 클릭 시 닫기 — portal 드롭다운까지 포함
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch('');
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 스크롤/리사이즈 시 닫기 (위치 어긋남 방지)
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setSearch(''); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const uniqueValues = useMemo(
    () => [...values].sort(sortFn || ((a, b) => a.localeCompare(b, 'ko'))),
    [values, sortFn],
  );

  const filteredValues = useMemo(() => {
    if (!search.trim()) return uniqueValues;
    const q = search.trim().toLowerCase();
    return uniqueValues.filter(v => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  const NONE_SENTINEL = '\0__NONE__\0';
  const isCleared = selected.size === 1 && selected.has(NONE_SENTINEL);
  const hasFilter = isCleared || (selected.size > 0 && selected.size < uniqueValues.length);

  const selectAll = () => onChange(new Set());
  const clearAll = () => onChange(new Set([NONE_SENTINEL]));

  const toggleValue = (v: string) => {
    const base = isCleared
      ? new Set<string>()
      : selected.size === 0
        ? new Set(uniqueValues)
        : new Set(selected);
    if (base.has(v)) {
      base.delete(v);
      if (base.size === 0) {
        onChange(new Set([NONE_SENTINEL]));
        return;
      }
    } else {
      base.add(v);
      if (base.size === uniqueValues.length) {
        onChange(new Set());
        return;
      }
    }
    onChange(base);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1.5 font-medium select-none whitespace-nowrap hover:text-gray-700 ${
          align === 'right' ? 'justify-end w-full' : align === 'center' ? 'justify-center w-full' : ''
        } ${hasFilter ? 'text-blue-600' : 'text-gray-500'}`}
      >
        {children}
        <span className="text-[10px] ml-0.5">
          {sortKey !== null ? (sortDir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
        {hasFilter && <span className="w-1.5 h-1.5 rounded-sm bg-blue-500 ml-0.5" />}
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: pos.top,
            ...(pos.right !== undefined ? { right: pos.right } : { left: pos.left }),
          }}
          className="z-[200] w-64 rounded-sm border border-gray-200 bg-white shadow-lg"
        >
          {/* 정렬 */}
          <div className="border-b border-gray-200 p-1">
            <button
              onClick={() => { onSort('asc'); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 text-gray-700"
            >
              정렬: 오름차순
            </button>
            <button
              onClick={() => { onSort('desc'); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 text-gray-700"
            >
              정렬: 내림차순
            </button>
          </div>

          {/* 값별 체크박스 필터 */}
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs space-x-2">
                <button onClick={selectAll} className="text-blue-600 hover:text-blue-800">
                  전체 선택
                </button>
                <span className="text-gray-300">·</span>
                <button onClick={clearAll} className="text-blue-600 hover:text-blue-800">
                  선택 해제
                </button>
              </div>
              <span className="text-xs text-gray-400">
                {isCleared ? 0 : hasFilter ? selected.size : uniqueValues.length}개 표시 중
              </span>
            </div>
            <input
              type="text"
              placeholder="검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filteredValues.map(v => {
                const checked = selected.size === 0 || selected.has(v);
                return (
                  <label
                    key={v}
                    className="flex items-center gap-2 px-1 py-1 rounded text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(v)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 truncate">{v || '(공백)'}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 하단 */}
          <div className="border-t border-gray-100 p-2 flex justify-end gap-2">
            <button
              onClick={() => { onChange(new Set()); setOpen(false); }}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 rounded"
            >
              초기화
            </button>
            <button
              onClick={() => { setOpen(false); setSearch(''); }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              확인
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
