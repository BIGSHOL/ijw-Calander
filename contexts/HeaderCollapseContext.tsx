import React, { createContext, useContext } from 'react';

interface HeaderCollapseContextType {
  isHeaderCollapsed: boolean;
}

const HeaderCollapseContext = createContext<HeaderCollapseContextType>({
  isHeaderCollapsed: false,
});

export const useHeaderCollapse = () => useContext(HeaderCollapseContext);

export const HeaderCollapseProvider: React.FC<{
  isHeaderCollapsed: boolean;
  children: React.ReactNode;
}> = ({ isHeaderCollapsed, children }) => {
  return (
    <HeaderCollapseContext.Provider value={{ isHeaderCollapsed }}>
      {children}
    </HeaderCollapseContext.Provider>
  );
};
