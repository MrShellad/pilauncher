// /src/ui/primitives/OreTag.tsx
import React from 'react';

export type OreTagVariant = 
  | 'neutral' 
  | 'primary' 
  | 'informative' 
  | 'notice' 
  | 'warning' 
  | 'realms';

export type OreTagSize = 'sm' | 'md' | 'lg';
export type OreTagWeight = 'normal' | 'bold';

export interface OreTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: OreTagVariant;
  size?: OreTagSize;
  weight?: OreTagWeight;
  className?: string;
  children: React.ReactNode;
}

export const OreTag: React.FC<OreTagProps> = ({
  variant = 'neutral',
  size = 'md',
  weight = 'normal',
  className = '',
  children,
  ...props
}) => {
  return (
    <span
      className={`
        ore-tag 
        ore-tag-${variant} 
        ore-tag-${size} 
        ore-tag-${weight} 
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};