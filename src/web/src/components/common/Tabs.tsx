import React, { useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { IBaseProps } from '../../interfaces/common.interface';
import { themeConfig } from '../../config/theme.config';

// Interfaces
interface ITab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  icon?: string;
}

interface ITabsProps extends IBaseProps {
  tabs: ITab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  orientation?: 'horizontal' | 'vertical';
  fullWidth?: boolean;
  ariaLabel?: string;
  lazyLoad?: boolean;
}

// Styled Components
const TabsContainer = styled.div<{
  orientation?: string;
  fullWidth?: boolean;
}>`
  display: flex;
  flex-direction: ${props => props.orientation === 'vertical' ? 'column' : 'row'};
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  border-bottom: 1px solid ${themeConfig.colors.surface.light.paper};
  margin-bottom: ${themeConfig.spacing.base.md};
  position: relative;
  min-height: 48px;
  
  @media (max-width: ${themeConfig.breakpoints.sm}) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: ${themeConfig.colors.primary.light};
      border-radius: 4px;
    }
  }
`;

const TabButton = styled.button<{
  active: boolean;
  disabled?: boolean;
  orientation?: string;
}>`
  padding: ${themeConfig.spacing.base.sm} ${themeConfig.spacing.base.md};
  border: none;
  background: none;
  color: ${props => props.active ? themeConfig.colors.primary.main : themeConfig.colors.primary.dark};
  font-family: ${themeConfig.typography.fontFamily.primary};
  font-size: ${themeConfig.typography.fontSize.md};
  font-weight: ${props => props.active ? themeConfig.typography.fontWeight.medium : themeConfig.typography.fontWeight.regular};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.5 : 1};
  border-bottom: 2px solid ${props => props.active ? themeConfig.colors.primary.main : 'transparent'};
  min-width: 90px;
  min-height: 48px;
  position: relative;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${themeConfig.spacing.base.sm};

  &:focus-visible {
    outline: 2px solid ${themeConfig.colors.primary.main};
    outline-offset: -2px;
    border-radius: 4px;
  }

  &:hover:not(:disabled) {
    background-color: ${themeConfig.colors.surface.light.elevated};
    color: ${themeConfig.colors.primary.main};
  }

  ${props => props.orientation === 'vertical' && `
    border-bottom: none;
    border-left: 2px solid ${props.active ? themeConfig.colors.primary.main : 'transparent'};
    width: 100%;
    justify-content: flex-start;
  `}
`;

const TabContent = styled.div`
  padding: ${themeConfig.spacing.base.md};
`;

// Keyboard Navigation Handler
const handleKeyboardNavigation = (
  event: React.KeyboardEvent,
  tabs: ITab[],
  activeTabId: string,
  onTabChange: (tabId: string) => void,
  orientation?: string
): void => {
  const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= tabs.length) nextIndex = 0;
      while (tabs[nextIndex].disabled && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % tabs.length;
      }
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) nextIndex = tabs.length - 1;
      while (tabs[nextIndex].disabled && nextIndex !== currentIndex) {
        nextIndex = nextIndex - 1 < 0 ? tabs.length - 1 : nextIndex - 1;
      }
      break;
    case 'Home':
      event.preventDefault();
      nextIndex = 0;
      while (tabs[nextIndex].disabled && nextIndex < tabs.length - 1) {
        nextIndex++;
      }
      break;
    case 'End':
      event.preventDefault();
      nextIndex = tabs.length - 1;
      while (tabs[nextIndex].disabled && nextIndex > 0) {
        nextIndex--;
      }
      break;
    default:
      return;
  }

  if (nextIndex !== currentIndex && !tabs[nextIndex].disabled) {
    onTabChange(tabs[nextIndex].id);
  }
};

export const Tabs: React.FC<ITabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  orientation = 'horizontal',
  fullWidth = false,
  ariaLabel = 'Tab Navigation',
  lazyLoad = true,
  className,
  style
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback((tabId: string) => {
    if (tabs.find(tab => tab.id === tabId)?.disabled) return;
    onTabChange(tabId);
  }, [tabs, onTabChange]);

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (tabsRef.current && orientation === 'horizontal') {
      const activeTab = tabsRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTabId, orientation]);

  return (
    <div className={className} style={style}>
      <TabsContainer
        ref={tabsRef}
        orientation={orientation}
        fullWidth={fullWidth}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
      >
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            role="tab"
            data-tab-id={tab.id}
            aria-selected={activeTabId === tab.id}
            aria-controls={`panel-${tab.id}`}
            aria-label={tab.ariaLabel || tab.label}
            aria-disabled={tab.disabled}
            tabIndex={activeTabId === tab.id ? 0 : -1}
            active={activeTabId === tab.id}
            disabled={tab.disabled}
            orientation={orientation}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyboardNavigation(e, tabs, activeTabId, onTabChange, orientation)}
          >
            {tab.icon && <span className="material-icons">{tab.icon}</span>}
            {tab.label}
          </TabButton>
        ))}
      </TabsContainer>
      {tabs.map(tab => (
        <TabContent
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={tab.id}
          hidden={activeTabId !== tab.id}
          style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
        >
          {(!lazyLoad || activeTabId === tab.id) && tab.content}
        </TabContent>
      ))}
    </div>
  );
};

export type { ITab, ITabsProps };