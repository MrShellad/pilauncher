import React from 'react';

interface NewspaperIconProps {
  className?: string;
}

export const NewspaperIcon: React.FC<NewspaperIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 26"
    aria-hidden="true"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 3H4C2.9 3 2 3.9 2 5v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14H5v-2h6v2zm0-4H5v-2h6v2zm0-4H5V7h6v2zm8 8h-6v-2h6v2zm0-4h-6v-2h6v2zm0-4h-6V7h6v2z" />
  </svg>
);
