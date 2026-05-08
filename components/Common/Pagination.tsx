import React from 'react';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 표준 페이지네이션 (첫/마지막/현재±1만 표시, 중간은 ... 으로 축약)
 */
export const Pagination: React.FC<Props> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-sm border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-100"
      >
        이전
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-2 text-sm text-gray-400">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`rounded-sm px-3 py-1.5 text-sm ${
              p === currentPage
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-sm border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-100"
      >
        다음
      </button>
    </div>
  );
};
