import React from 'react';

import { ControlHint, type ControlHintSize } from './ControlHint';

export type GamepadButton =
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'LB'
  | 'RB'
  | 'LT'
  | 'RT'
  | 'MENU'
  | 'VIEW'
  | 'LS'
  | 'RS';

export type GamepadButtonTone = 'neutral' | 'dark' | 'green' | 'red' | 'yellow' | 'blue';
export type GamepadButtonVariant = 'keyboard' | 'bumper' | 'trigger' | 'face';

export interface GamepadButtonIconProps {
  button: GamepadButton;
  tone?: GamepadButtonTone;
  size?: ControlHintSize;
  className?: string;
}

export interface GamepadActionHintProps extends GamepadButtonIconProps {
  label: string;
  labelClassName?: string;
}

const buttonPreset: Record<GamepadButton, { label: string; variant: GamepadButtonVariant; tone: GamepadButtonTone }> = {
  A: { label: 'A', variant: 'face', tone: 'green' },
  B: { label: 'B', variant: 'face', tone: 'red' },
  X: { label: 'X', variant: 'face', tone: 'blue' },
  Y: { label: 'Y', variant: 'face', tone: 'yellow' },
  LB: { label: 'LB', variant: 'bumper', tone: 'dark' },
  RB: { label: 'RB', variant: 'bumper', tone: 'dark' },
  LT: { label: 'LT', variant: 'trigger', tone: 'dark' },
  RT: { label: 'RT', variant: 'trigger', tone: 'dark' },
  MENU: { label: 'Menu', variant: 'keyboard', tone: 'dark' },
  VIEW: { label: 'View', variant: 'keyboard', tone: 'dark' },
  LS: { label: 'LS', variant: 'keyboard', tone: 'dark' },
  RS: { label: 'RS', variant: 'keyboard', tone: 'dark' },
};

export const GamepadButtonIcon: React.FC<GamepadButtonIconProps> = ({ button, tone, size, className }) => {
  const preset = buttonPreset[button];
  return (
    <ControlHint
      label={preset.label}
      variant={preset.variant}
      tone={tone || preset.tone}
      size={size}
      className={className}
    />
  );
};

export const GamepadActionHint: React.FC<GamepadActionHintProps> = ({
  button,
  tone,
  size,
  className = '',
  label,
  labelClassName = '',
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <GamepadButtonIcon button={button} tone={tone} size={size} />
    <span
      className={`font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted ${labelClassName}`}
    >
      {label}
    </span>
  </div>
);
