/**
 * @file Footer component implementing the application's footer section
 * @version 1.0.0
 * 
 * Implements Material Design 3.0 guidelines with enhanced accessibility features
 * and responsive design for the smart-apparel system's footer section.
 */

import React from 'react'; // v18.2.0
import styled from '@emotion/styled'; // v11.11.0
import { themeConfig } from '../../config/theme.config';
import type { IBaseProps } from '../../interfaces/common.interface';

// Interface for social media link items
interface SocialLink {
  name: string;
  url: string;
  icon: string;
  ariaLabel: string;
}

// Interface for legal/policy links
interface LegalLink {
  name: string;
  url: string;
  ariaLabel: string;
}

// Props interface extending base component props
interface FooterProps extends IBaseProps {
  companyName: string;
  version: string;
  socialLinks: SocialLink[];
  legalLinks: LegalLink[];
}

// Helper function to get current year for copyright notice
const getCurrentYear = (): number => new Date().getFullYear();

// Styled components with Material Design 3.0 implementation
const FooterContainer = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${themeConfig.spacing.base.lg};
  background-color: ${themeConfig.colors.surface.light.paper};
  border-top: 1px solid ${themeConfig.colors.primary.light}20;
  margin-top: auto;
  width: 100%;
  min-height: 120px;
  
  @media (prefers-color-scheme: dark) {
    background-color: ${themeConfig.colors.surface.dark.paper};
    border-top-color: ${themeConfig.colors.primary.dark}20;
  }
`;

const FooterContent = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: ${themeConfig.breakpoints.lg};
  gap: ${themeConfig.spacing.base.md};
  padding: 0 ${themeConfig.spacing.base.md};

  @media (max-width: ${themeConfig.breakpoints.sm}) {
    flex-direction: column;
    text-align: center;
    gap: ${themeConfig.spacing.base.sm};
  }
`;

const Copyright = styled.p`
  color: ${themeConfig.colors.primary.main};
  font-size: ${themeConfig.typography.fontSize.sm};
  margin: 0;
  font-weight: ${themeConfig.typography.fontWeight.regular};
  font-family: ${themeConfig.typography.fontFamily.primary};
  
  @media (prefers-color-scheme: dark) {
    color: ${themeConfig.colors.primary.light};
  }
`;

const SocialLinks = styled.div`
  display: flex;
  gap: ${themeConfig.spacing.base.sm};
  align-items: center;
`;

const SocialLink = styled.a`
  color: ${themeConfig.colors.primary.main};
  font-size: ${themeConfig.typography.fontSize.md};
  text-decoration: none;
  padding: ${themeConfig.spacing.base.xs};
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover, &:focus {
    background-color: ${themeConfig.colors.primary.light}20;
  }

  &:focus-visible {
    outline: 2px solid ${themeConfig.colors.primary.main};
    outline-offset: 2px;
  }

  @media (prefers-color-scheme: dark) {
    color: ${themeConfig.colors.primary.light};
  }
`;

const LegalLinks = styled.nav`
  display: flex;
  gap: ${themeConfig.spacing.base.md};

  @media (max-width: ${themeConfig.breakpoints.sm}) {
    flex-direction: column;
    gap: ${themeConfig.spacing.base.xs};
  }
`;

const LegalLink = styled.a`
  color: ${themeConfig.colors.primary.main};
  font-size: ${themeConfig.typography.fontSize.sm};
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover, &:focus {
    color: ${themeConfig.colors.primary.dark};
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${themeConfig.colors.primary.main};
    outline-offset: 2px;
  }

  @media (prefers-color-scheme: dark) {
    color: ${themeConfig.colors.primary.light};
    
    &:hover, &:focus {
      color: ${themeConfig.colors.primary.light};
    }
  }
`;

const VersionText = styled.span`
  color: ${themeConfig.colors.primary.main}80;
  font-size: ${themeConfig.typography.fontSize.xs};
  margin-left: ${themeConfig.spacing.base.sm};

  @media (prefers-color-scheme: dark) {
    color: ${themeConfig.colors.primary.light}80;
  }
`;

/**
 * Footer component with enhanced accessibility and responsive design
 * following Material Design 3.0 guidelines
 */
const Footer: React.FC<FooterProps> = ({
  companyName,
  version,
  socialLinks,
  legalLinks,
  className,
  style
}) => {
  return (
    <FooterContainer 
      className={className}
      style={style}
      role="contentinfo"
      aria-label="Site footer"
    >
      <FooterContent>
        <Copyright>
          © {getCurrentYear()} {companyName}
          <VersionText>v{version}</VersionText>
        </Copyright>

        <SocialLinks aria-label="Social media links">
          {socialLinks.map((link) => (
            <SocialLink
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.ariaLabel}
            >
              <span 
                className={link.icon} 
                aria-hidden="true"
              />
            </SocialLink>
          ))}
        </SocialLinks>

        <LegalLinks aria-label="Legal information links">
          {legalLinks.map((link) => (
            <LegalLink
              key={link.name}
              href={link.url}
              aria-label={link.ariaLabel}
            >
              {link.name}
            </LegalLink>
          ))}
        </LegalLinks>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;