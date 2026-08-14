import React from 'react';

import { OreButton, type OreButtonProps } from './OreButton';
import { OreTooltip } from './OreTooltip';

interface OreIconButtonProps extends Omit<OreButtonProps, 'children' | 'size' | 'aria-label'> {
  icon: React.ReactNode;
  label: string;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
}

export const OreIconButton: React.FC<OreIconButtonProps> = ({
  icon,
  label,
  tooltipPlacement = 'top',
  ...buttonProps
}) => (
  <OreTooltip content={label} placement={tooltipPlacement}>
    <OreButton
      {...buttonProps}
      size="icon"
      aria-label={label}
      title={label}
    >
      {icon}
    </OreButton>
  </OreTooltip>
);
