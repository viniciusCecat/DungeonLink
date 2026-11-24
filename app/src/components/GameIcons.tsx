import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const IconSword: React.FC<IconProps> = ({ size = 28, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M19.5 3.5L13.5 4.5L5.5 12.5L3 12L2 13L5.5 16.5L3 19L5 21L7.5 18.5L11 22L12 21L11.5 18.5L19.5 10.5L20.5 4.5L19.5 3.5Z" fill="currentColor" />
    <path d="M18.5 5.5L10.5 13.5" stroke="#fff3bf" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IconDash: React.FC<IconProps> = ({ size = 22, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M13 2L4 14H11L9 22L20 9.5H13L13 2Z" fill="currentColor" stroke="#e3fafc" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export const IconPotion: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M9 3H15M10 3V7.5L5.8 14.5C4.8 16.2 6 19 8.2 19H15.8C18 19 19.2 16.2 18.2 14.5L14 7.5V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 14H16.5L17.4 15.6C17.9 16.6 17.2 17.8 16 17.8H8C6.8 17.8 6.1 16.6 6.6 15.6L7.5 14Z" fill="#69db7c" />
  </svg>
);

export const IconBag: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M8 7V5.5C8 4.1 9.1 3 10.5 3H13.5C14.9 3 16 4.1 16 5.5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="4" y="7" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="2" fill="rgba(255,212,59,0.22)" />
    <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" />
    <rect x="10.5" y="10.5" width="3" height="3.5" rx="0.8" fill="#fff3bf" />
  </svg>
);

export const IconGear: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2.5V5M12 19V21.5M4.9 4.9L6.7 6.7M17.3 17.3L19.1 19.1M2.5 12H5M19 12H21.5M4.9 19.1L6.7 17.3M17.3 6.7L19.1 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconMultiplayer: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 19C3 16.2 5.4 14 8.5 14C11.6 14 14 16.2 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M15.5 14.3C18.2 14.7 20.5 16.6 20.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconMap: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M9 3V18M15 6V21" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const IconBluetooth: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M7 7L17 17L12 22V2L17 7L7 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
