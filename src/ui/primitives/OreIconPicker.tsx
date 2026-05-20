import React from 'react';
import {
  Blocks,
  Bomb,
  Box,
  Castle,
  Compass,
  Crosshair,
  Crown,
  Diamond,
  Dices,
  Flame,
  FlaskConical,
  Gamepad2,
  Gem,
  Ghost,
  Hammer,
  Joystick,
  Leaf,
  Map,
  Mountain,
  Package,
  Pickaxe,
  ScrollText,
  Shield,
  ShieldCheck,
  Skull,
  Snowflake,
  Sparkles,
  Swords,
  Tag,
  Target,
  Tent,
  Trophy,
  Wrench,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';

export interface OreIconOption {
  id: string;
  icon: LucideIcon;
  label: string;
}

export const ORE_DEFAULT_ICON_ID = 'tag';

export const ORE_ICON_OPTIONS: OreIconOption[] = [
  { id: 'tag', icon: Tag, label: 'Tag' },
  { id: 'swords', icon: Swords, label: 'Swords' },
  { id: 'shield', icon: Shield, label: 'Shield' },
  { id: 'shield-check', icon: ShieldCheck, label: 'Shield Check' },
  { id: 'pickaxe', icon: Pickaxe, label: 'Pickaxe' },
  { id: 'hammer', icon: Hammer, label: 'Hammer' },
  { id: 'wrench', icon: Wrench, label: 'Wrench' },
  { id: 'gem', icon: Gem, label: 'Gem' },
  { id: 'diamond', icon: Diamond, label: 'Diamond' },
  { id: 'blocks', icon: Blocks, label: 'Blocks' },
  { id: 'box', icon: Box, label: 'Box' },
  { id: 'package', icon: Package, label: 'Package' },
  { id: 'flame', icon: Flame, label: 'Flame' },
  { id: 'snowflake', icon: Snowflake, label: 'Snowflake' },
  { id: 'leaf', icon: Leaf, label: 'Leaf' },
  { id: 'mountain', icon: Mountain, label: 'Mountain' },
  { id: 'castle', icon: Castle, label: 'Castle' },
  { id: 'tent', icon: Tent, label: 'Tent' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'compass', icon: Compass, label: 'Compass' },
  { id: 'scroll', icon: ScrollText, label: 'Scroll' },
  { id: 'crown', icon: Crown, label: 'Crown' },
  { id: 'trophy', icon: Trophy, label: 'Trophy' },
  { id: 'skull', icon: Skull, label: 'Skull' },
  { id: 'ghost', icon: Ghost, label: 'Ghost' },
  { id: 'bomb', icon: Bomb, label: 'Bomb' },
  { id: 'target', icon: Target, label: 'Target' },
  { id: 'crosshair', icon: Crosshair, label: 'Crosshair' },
  { id: 'gamepad', icon: Gamepad2, label: 'Gamepad' },
  { id: 'joystick', icon: Joystick, label: 'Joystick' },
  { id: 'dices', icon: Dices, label: 'Dices' },
  { id: 'flask', icon: FlaskConical, label: 'Flask' },
  { id: 'wand', icon: WandSparkles, label: 'Wand' },
  { id: 'sparkles', icon: Sparkles, label: 'Sparkles' },
];

export const normalizeOreIconId = (value?: string) =>
  value && ORE_ICON_OPTIONS.some((option) => option.id === value) ? value : ORE_DEFAULT_ICON_ID;

export const getOreIcon = (iconId?: string) =>
  ORE_ICON_OPTIONS.find((option) => option.id === normalizeOreIconId(iconId))?.icon ?? Tag;

interface OreIconPickerProps {
  value: string;
  onChange: (iconId: string) => void;
  disabled?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  panelClassName?: string;
}

export const OreIconPicker: React.FC<OreIconPickerProps> = ({
  value,
  onChange,
  disabled,
  isOpen,
  onOpenChange,
  title = '选择图标',
  panelClassName = '',
}) => {
  const normalizedValue = normalizeOreIconId(value);
  const SelectedIcon = getOreIcon(normalizedValue);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!isOpen)}
        title={title}
        className={[
          'flex h-10 w-10 items-center justify-center border-[0.125rem] border-[#1E1E1F] bg-[#D0D1D4] text-[#111214] outline-none transition-none',
          'shadow-[inset_0_-0.25rem_0_#58585A,inset_0.1875rem_0.1875rem_0_rgba(255,255,255,0.6),inset_-0.1875rem_-0.4375rem_0_rgba(255,255,255,0.4)]',
          'hover:bg-[#B1B2B5] hover:outline hover:outline-[0.125rem] hover:-outline-offset-[0.125rem] hover:outline-white focus-visible:outline focus-visible:outline-[0.125rem] focus-visible:-outline-offset-[0.125rem] focus-visible:outline-white disabled:opacity-50',
        ].join(' ')}
      >
        <SelectedIcon size={18} strokeWidth={2.5} />
      </button>

      {isOpen && (
        <div
          className={[
            'absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[24rem] border-[0.125rem] border-[#1E1E1F] bg-[#E6E8EB] text-[#111214]',
            'shadow-[0_0.75rem_1.5rem_rgba(0,0,0,0.35),inset_0_0.125rem_0_rgba(255,255,255,0.7),inset_0_-0.125rem_0_#B1B2B5]',
            panelClassName,
          ].join(' ')}
        >
          <div className="grid grid-cols-8 gap-2 p-4">
            {ORE_ICON_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.id === normalizedValue;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  title={option.label}
                  onClick={() => {
                    onChange(option.id);
                    onOpenChange(false);
                  }}
                  className={[
                    'flex h-9 w-9 items-center justify-center border-[0.125rem] outline-none transition-none',
                    selected
                      ? 'border-[#1E1E1F] bg-[#D0D1D4] shadow-[inset_0_-0.1875rem_0_#8C8D90,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.6)]'
                      : 'border-transparent bg-transparent hover:border-[#1E1E1F] hover:bg-[#F4F6F9] focus-visible:border-[#1E1E1F] focus-visible:bg-[#F4F6F9]',
                  ].join(' ')}
                >
                  <Icon size={20} strokeWidth={2.3} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
