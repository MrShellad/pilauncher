import React from 'react';

import { ControlHint } from './ControlHint';

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
  LB: { label: 'LB', variant: 'bumper', tone: 'neutral' },
  RB: { label: 'RB', variant: 'bumper', tone: 'neutral' },
  LT: { label: 'LT', variant: 'trigger', tone: 'neutral' },
  RT: { label: 'RT', variant: 'trigger', tone: 'neutral' },
  MENU: { label: 'Menu', variant: 'keyboard', tone: 'neutral' },
  VIEW: { label: 'View', variant: 'keyboard', tone: 'neutral' },
  LS: { label: 'LS', variant: 'keyboard', tone: 'dark' },
  RS: { label: 'RS', variant: 'keyboard', tone: 'dark' },
};

export const GamepadButtonIcon: React.FC<GamepadButtonIconProps> = ({ button, tone, className }) => {
  const preset = buttonPreset[button];
  return (
    <ControlHint
      label={preset.label}
      variant={preset.variant}
      tone={tone || preset.tone}
      className={className}
    />
  );
};

export const GamepadActionHint: React.FC<GamepadActionHintProps> = ({
  button,
  tone,
  className = '',
  label,
  labelClassName = '',
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <GamepadButtonIcon button={button} tone={tone} />
    <span
      className={`font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted ${labelClassName}`}
    >
      {label}
    </span>
  </div>
);
