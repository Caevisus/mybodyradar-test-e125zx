import React, { useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/route.constants';

// Styled components with Material Design 3.0 implementation
const SidebarContainer = styled.aside<{ isCollapsed: boolean }>`
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: ${({ isCollapsed }) => (isCollapsed ? '64px' : '240px')};
  background: ${({ theme }) => theme.colors.surface.light.elevated};
  box-shadow: ${({ theme }) => theme.shadows.md};
  transition: width 0.3s ease;
  z-index: 1000;
  overflow-x: hidden;
  overflow-y: auto;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: ${({ isCollapsed }) => (isCollapsed ? '0' : '100%')};
  }
`;

const MenuList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${({ theme }) => theme.spacing.base.md} 0;
`;

const MenuItem = styled.li<{ active?: boolean }>`
  padding: ${({ theme }) => theme.spacing.base.sm} ${({ theme }) => theme.spacing.base.md};
  margin: ${({ theme }) => theme.spacing.base.xs} 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${({ theme, active }) => 
    active ? theme.colors.primary.main : theme.colors.surface.dark.paper};
  background: ${({ theme, active }) => 
    active ? `${theme.colors.primary.main}10` : 'transparent'};
  border-radius: 4px;
  transition: all 0.2s ease;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary.main}20`};
  }
`;

const MenuIcon = styled.span`
  margin-right: ${({ theme }) => theme.spacing.base.sm};
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MenuText = styled.span<{ isCollapsed: boolean }>`
  opacity: ${({ isCollapsed }) => (isCollapsed ? 0 : 1)};
  transition: opacity 0.2s ease;
  white-space: nowrap;
`;

// Interfaces
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  allowedRoles: string[];
}

// Menu items generator with role-based filtering
const getMenuItems = (userRole: string): MenuItem[] => {
  const baseItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: ROUTES.DASHBOARD.ROOT,
      icon: '📊',
      allowedRoles: ['athlete', 'coach', 'medical', 'admin']
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: ROUTES.ANALYTICS.ROOT,
      icon: '📈',
      allowedRoles: ['coach', 'medical', 'admin']
    },
    {
      id: 'alerts',
      label: 'Alerts',
      path: ROUTES.ALERTS.ROOT,
      icon: '🔔',
      allowedRoles: ['athlete', 'coach', 'medical', 'admin']
    },
    {
      id: 'team',
      label: 'Team',
      path: ROUTES.TEAM.ROOT,
      icon: '👥',
      allowedRoles: ['coach', 'admin']
    },
    {
      id: 'medical',
      label: 'Medical',
      path: ROUTES.MEDICAL.ROOT,
      icon: '🏥',
      allowedRoles: ['medical', 'admin']
    },
    {
      id: 'settings',
      label: 'Settings',
      path: ROUTES.SETTINGS.ROOT,
      icon: '⚙️',
      allowedRoles: ['athlete', 'coach', 'medical', 'admin']
    }
  ];

  return baseItems.filter(item => item.allowedRoles.includes(userRole));
};

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();

  // Memoized menu items based on user role
  const menuItems = useMemo(() => {
    if (!user?.role) return [];
    return getMenuItems(user.role);
  }, [user?.role]);

  // Navigation handler with analytics and error handling
  const handleNavigation = useCallback((path: string) => {
    try {
      navigate(path);
      // Close sidebar on mobile after navigation
      if (window.innerWidth <= parseInt(theme.breakpoints.sm)) {
        onToggle();
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate, onToggle, theme.breakpoints.sm]);

  // Effect for handling responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= parseInt(theme.breakpoints.sm) && !isCollapsed) {
        onToggle();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, onToggle, theme.breakpoints.sm]);

  if (!isAuthenticated) return null;

  return (
    <SidebarContainer isCollapsed={isCollapsed} theme={theme}>
      <MenuList>
        {menuItems.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            active={window.location.pathname.startsWith(item.path)}
          >
            <MenuIcon>{item.icon}</MenuIcon>
            <MenuText isCollapsed={isCollapsed}>{item.label}</MenuText>
          </MenuItem>
        ))}
      </MenuList>
    </SidebarContainer>
  );
};

export default Sidebar;