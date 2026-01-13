import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = true,
  className = '',
}) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-sm ${className}`}
    >
      <ol className="flex items-center gap-2" role="list">
        {showHome && (
          <>
            <li>
              <button
                onClick={items[0]?.onClick}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                aria-label="홈으로 이동"
              >
                <Home size={14} />
                <span className="sr-only">홈</span>
              </button>
            </li>
            {items.length > 0 && (
              <li aria-hidden="true">
                <ChevronRight size={14} className="text-gray-600" />
              </li>
            )}
          </>
        )}
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <React.Fragment key={index}>
              <li>
                {item.onClick && !isLast ? (
                  <button
                    onClick={item.onClick}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-current={item.isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={isLast ? 'text-[#fdb813] font-medium' : 'text-gray-300'}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight size={14} className="text-gray-600" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;