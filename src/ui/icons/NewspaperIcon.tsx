import React from 'react';

interface NewspaperIconProps {
  className?: string;
}

export const NewspaperIcon: React.FC<NewspaperIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 32 32"
    aria-hidden="true"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7 5.5H23.5C25.7091 5.5 27.5 7.29086 27.5 9.5V23C27.5 25.4853 25.4853 27.5 23 27.5H10C7.51472 27.5 5.5 25.4853 5.5 23V7C5.5 6.17157 6.17157 5.5 7 5.5Z" fill="currentColor" fillOpacity="0.18" />
    <path d="M8 5.5H24C26.2091 5.5 28 7.29086 28 9.5V22.5C28 25.2614 25.7614 27.5 23 27.5H11C8.23858 27.5 6 25.2614 6 22.5V7.5C6 6.39543 6.89543 5.5 8 5.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M10.5 10H22.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M10.5 14.5H22.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M10.5 19H17.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="18.5" y="18" width="4" height="5.5" rx="0.8" fill="currentColor" />
    <path d="M6 22.5C6 25.2614 8.23858 27.5 11 27.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
