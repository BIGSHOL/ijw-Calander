import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * Accessible Table Component
 * Addresses Issue #30: Table sortable headers with ARIA
 * 
 * Features:
 * - Sortable columns with keyboard support
 * - ARIA attributes for screen readers
 * - Responsive design
 * - Sticky headers option
 */

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  sortBy?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  stickyHeader?: boolean;
  caption?: string;
  emptyMessage?: string;
  className?: string;
}

function Table<T>({
  columns,
  data,
  keyExtractor,
  sortBy,
  sortDirection,
  onSort,
  stickyHeader = false,
  caption,
  emptyMessage = '데이터가 없습니다',
  className = '',
}: TableProps<T>) {
  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable && onSort) {
      onSort(key);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string, sortable?: boolean) => {
    if ((e.key === 'Enter' || e.key === ' ') && sortable && onSort) {
      e.preventDefault();
      onSort(key);
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ChevronsUpDown size={14} className="text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-accent" />
    ) : (
      <ChevronDown size={14} className="text-accent" />
    );
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200" role="table">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
          <tr role="row">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
                  ${column.width ? column.width : ''}
                `}
                onClick={() => handleSort(column.key, column.sortable)}
                onKeyDown={(e) => handleKeyDown(e, column.key, column.sortable)}
                tabIndex={column.sortable ? 0 : undefined}
                role="columnheader"
                aria-sort={
                  sortBy === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : column.sortable
                    ? 'none'
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && getSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="hover:bg-gray-50 transition-colors"
                role="row"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    role="cell"
                  >
                    {column.render
                      ? column.render(row)
                      : (row as any)[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;