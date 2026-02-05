import React from 'react';

/**
 * Skip Link Component
 * Addresses Issue #7: Critical accessibility issue
 */

interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
}

const SkipLink: React.FC<SkipLinkProps> = ({ targetId, children }) => {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-3 focus:bg-accent focus:text-primary focus:font-semibold focus:rounded-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {children}
    </a>
  );
};

export default SkipLink;
