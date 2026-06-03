// src/ui/primitives/OreTooltip.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

// Merge refs utility to allow wrapping components that also use refs
export function useMergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return useCallback((value: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref && 'current' in ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  }, [refs]);
}

export interface OreTooltipProps {
  /** Tooltip text or node */
  content: React.ReactNode;
  /** Trigger element */
  children: React.ReactElement;
  /** Placement direction relative to trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment of tooltip */
  align?: 'start' | 'center' | 'end';
  /** Delay before displaying in ms */
  delay?: number;
  /** Toggle rendering in document.body Portal to avoid clipping */
  portal?: boolean;
  /** Disable tooltip showing */
  disabled?: boolean;
  /** Background color of the bubble content (defaults to OreTheme info blue) */
  backgroundColor?: string;
  /** Border outline color (defaults to OreTheme dark grey) */
  borderColor?: string;
  /** Custom class for the tooltip bubble wrapper */
  className?: string;
  /** Control visibility externally */
  visible?: boolean;
}

export const OreTooltip: React.FC<OreTooltipProps> = ({
  content,
  children,
  placement = 'top',
  align = 'center',
  delay = 400,
  portal = true,
  disabled = false,
  backgroundColor = '#2E6BE5',
  borderColor = '#1E1E1F',
  className = '',
  visible: controlledVisible,
}) => {
  const tooltipId = React.useId();
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = controlledVisible !== undefined;
  const isShown = isControlled ? controlledVisible : isOpen;

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    arrowX?: number;
    arrowY?: number;
  }>({ top: 0, left: 0 });

  // Update positioning relative to trigger (for portal mode)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current || !portal) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const offset = 10; // offset spacing in px
    const viewportMargin = 8;

    let top = 0;
    let left = 0;

    // 1. Calculate raw positions
    if (placement === 'top') {
      top = triggerRect.top - tooltipRect.height - offset;
      if (align === 'center') {
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      } else if (align === 'start') {
        left = triggerRect.left;
      } else {
        left = triggerRect.right - tooltipRect.width;
      }
    } else if (placement === 'bottom') {
      top = triggerRect.bottom + offset;
      if (align === 'center') {
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      } else if (align === 'start') {
        left = triggerRect.left;
      } else {
        left = triggerRect.right - tooltipRect.width;
      }
    } else if (placement === 'left') {
      left = triggerRect.left - tooltipRect.width - offset;
      if (align === 'center') {
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      } else if (align === 'start') {
        top = triggerRect.top;
      } else {
        top = triggerRect.bottom - tooltipRect.height;
      }
    } else if (placement === 'right') {
      left = triggerRect.right + offset;
      if (align === 'center') {
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      } else if (align === 'start') {
        top = triggerRect.top;
      } else {
        top = triggerRect.bottom - tooltipRect.height;
      }
    }

    // 2. Viewport collision bounds check & adjustment
    const maxLeft = window.innerWidth - tooltipRect.width - viewportMargin;
    const maxTop = window.innerHeight - tooltipRect.height - viewportMargin;
    const adjustedLeft = Math.max(viewportMargin, Math.min(left, maxLeft));
    const adjustedTop = Math.max(viewportMargin, Math.min(top, maxTop));

    // 3. Arrow sliding/shifting calculations
    let arrowX: number | undefined;
    let arrowY: number | undefined;

    const arrowWidth = placement === 'top' || placement === 'bottom' ? (align === 'center' ? 14 : 12) : 10;
    const arrowHeight = placement === 'left' || placement === 'right' ? (align === 'center' ? 14 : 12) : 10;
    const cornerSafetyPadding = 14; // Prevent arrow from clipping over pixelated corners

    if (placement === 'top' || placement === 'bottom') {
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const targetArrowX = triggerCenter - adjustedLeft - arrowWidth / 2;
      const maxArrowX = tooltipRect.width - arrowWidth - cornerSafetyPadding;
      arrowX = Math.max(cornerSafetyPadding, Math.min(targetArrowX, maxArrowX));
    } else {
      const triggerCenter = triggerRect.top + triggerRect.height / 2;
      const targetArrowY = triggerCenter - adjustedTop - arrowHeight / 2;
      const maxArrowY = tooltipRect.height - arrowHeight - cornerSafetyPadding;
      arrowY = Math.max(cornerSafetyPadding, Math.min(targetArrowY, maxArrowY));
    }

    setCoords({
      top: adjustedTop,
      left: adjustedLeft,
      arrowX,
      arrowY,
    });
  }, [placement, align, portal]);

  // Handle position tracking on layout trigger
  useEffect(() => {
    if (!isShown || !portal) return;

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { capture: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, { capture: true });
    };
  }, [isShown, portal, updatePosition]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const handleShow = useCallback(() => {
    if (disabled || isControlled) return;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    if (delay > 0) {
      showTimeoutRef.current = setTimeout(() => {
        setIsOpen(true);
      }, delay);
    } else {
      setIsOpen(true);
    }
  }, [delay, disabled, isControlled]);

  const handleHide = useCallback(() => {
    if (isControlled) return;
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    setIsOpen(false);
  }, [isControlled]);

  // Clone trigger element and merge refs/events
  const triggerRefHandler = useMergeRefs(triggerRef, (children as any).ref);

  const trigger = React.cloneElement(children as React.ReactElement<any>, {
    ref: triggerRefHandler,
    'aria-describedby': isShown ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      (children as any).props.onMouseEnter?.(e);
      handleShow();
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      (children as any).props.onMouseLeave?.(e);
      handleHide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      (children as any).props.onFocus?.(e);
      handleShow();
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      (children as any).props.onBlur?.(e);
      handleHide();
    },
  });

  // Dynamic Pixelated SVG Arrow generation
  const renderArrow = (isPortalMode: boolean) => {
    let grid: number[][] = [];

    if (placement === 'top') {
      if (align === 'end') {
        grid = [
          [1, 2, 2, 2, 2, 1],
          [0, 1, 2, 2, 2, 1],
          [0, 0, 1, 2, 2, 1],
          [0, 0, 0, 1, 2, 1],
          [0, 0, 0, 0, 1, 1],
        ];
      } else if (align === 'start') {
        grid = [
          [1, 2, 2, 2, 2, 1],
          [1, 2, 2, 2, 1, 0],
          [1, 2, 2, 1, 0, 0],
          [1, 2, 1, 0, 0, 0],
          [1, 1, 0, 0, 0, 0],
        ];
      } else {
        grid = [
          [1, 2, 2, 2, 2, 2, 1],
          [0, 1, 2, 2, 2, 1, 0],
          [0, 0, 1, 2, 1, 0, 0],
          [0, 0, 0, 1, 0, 0, 0],
        ];
      }
    } else if (placement === 'bottom') {
      if (align === 'end') {
        grid = [
          [0, 0, 0, 0, 1, 1],
          [0, 0, 0, 1, 2, 1],
          [0, 0, 1, 2, 2, 1],
          [0, 1, 2, 2, 2, 1],
          [1, 2, 2, 2, 2, 1],
        ];
      } else if (align === 'start') {
        grid = [
          [1, 1, 0, 0, 0, 0],
          [1, 2, 1, 0, 0, 0],
          [1, 2, 2, 1, 0, 0],
          [1, 2, 2, 2, 1, 0],
          [1, 2, 2, 2, 2, 1],
        ];
      } else {
        grid = [
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 1, 2, 1, 0, 0],
          [0, 1, 2, 2, 2, 1, 0],
          [1, 2, 2, 2, 2, 2, 1],
        ];
      }
    } else if (placement === 'left') {
      if (align === 'end') {
        grid = [
          [1, 0, 0, 0, 0],
          [2, 1, 0, 0, 0],
          [2, 2, 1, 0, 0],
          [2, 2, 2, 1, 0],
          [2, 2, 2, 2, 1],
          [1, 1, 1, 1, 1],
        ];
      } else if (align === 'start') {
        grid = [
          [1, 1, 1, 1, 1],
          [2, 2, 2, 2, 1],
          [2, 2, 2, 1, 0],
          [2, 2, 1, 0, 0],
          [2, 1, 0, 0, 0],
          [1, 0, 0, 0, 0],
        ];
      } else {
        grid = [
          [1, 0, 0, 0],
          [2, 1, 0, 0],
          [2, 2, 1, 0],
          [2, 2, 2, 1],
          [2, 2, 1, 0],
          [2, 1, 0, 0],
          [1, 0, 0, 0],
        ];
      }
    } else {
      // placement === 'right'
      if (align === 'end') {
        grid = [
          [0, 0, 0, 0, 1],
          [0, 0, 0, 1, 2],
          [0, 0, 1, 2, 2],
          [0, 1, 2, 2, 2],
          [1, 2, 2, 2, 2],
          [1, 1, 1, 1, 1],
        ];
      } else if (align === 'start') {
        grid = [
          [1, 1, 1, 1, 1],
          [1, 2, 2, 2, 2],
          [0, 1, 2, 2, 2],
          [0, 0, 1, 2, 2],
          [0, 0, 0, 1, 2],
          [0, 0, 0, 0, 1],
        ];
      } else {
        grid = [
          [0, 0, 0, 1],
          [0, 0, 1, 2],
          [0, 1, 2, 2],
          [1, 2, 2, 2],
          [0, 1, 2, 2],
          [0, 0, 1, 2],
          [0, 0, 0, 1],
        ];
      }
    }

    const pixelSize = 2;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    const width = cols * pixelSize;
    const height = rows * pixelSize;

    // In portal mode, calculate exact absolute coords; in inline mode, rely on CSS absolute structures
    const inlineArrowClass = isPortalMode ? '' : 'ore-tooltip-arrow-inline';
    
    // Portal arrow inline positions
    const portalArrowStyle: React.CSSProperties = {};
    if (isPortalMode) {
      if (placement === 'top') {
        portalArrowStyle.bottom = -height + 2; // Overlap by 2px to merge border
        portalArrowStyle.left = coords.arrowX;
      } else if (placement === 'bottom') {
        portalArrowStyle.top = -height + 2;
        portalArrowStyle.left = coords.arrowX;
      } else if (placement === 'left') {
        portalArrowStyle.right = -width + 2;
        portalArrowStyle.top = coords.arrowY;
      } else if (placement === 'right') {
        portalArrowStyle.left = -width + 2;
        portalArrowStyle.top = coords.arrowY;
      }
    }

    return (
      <div 
        className={`ore-tooltip-arrow ${inlineArrowClass}`}
        style={isPortalMode ? portalArrowStyle : undefined}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
          {grid.flatMap((row, rIdx) =>
            row.map((cell, cIdx) => {
              if (cell === 0) return null;
              const color = cell === 1 ? borderColor : backgroundColor;
              return (
                <rect
                  key={`${rIdx}-${cIdx}`}
                  x={cIdx * pixelSize}
                  y={rIdx * pixelSize}
                  width={pixelSize}
                  height={pixelSize}
                  fill={color}
                />
              );
            })
          )}
        </svg>
      </div>
    );
  };

  // Motion animation parameters for clean Minecraft snapping entries
  const animationVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.08, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      transition: { duration: 0.06, ease: 'easeIn' }
    }
  } as any;

  const tooltipElement = (
    <AnimatePresence>
      {isShown && (
        <motion.div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          variants={animationVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`ore-tooltip-bubble ${
            portal ? '' : `ore-tooltip-bubble-inline placement-${placement} align-${align}`
          } ${className}`}
          style={
            portal
              ? {
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  zIndex: 10000,
                  borderColor,
                }
              : { borderColor }
          }
        >
          <div className="ore-tooltip-content" style={{ backgroundColor }}>
            {content}
          </div>
          {renderArrow(portal)}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (portal) {
    return (
      <>
        {trigger}
        {typeof document !== 'undefined' && createPortal(tooltipElement, document.body)}
      </>
    );
  }

  return (
    <div className="ore-tooltip-container-inline">
      {trigger}
      {tooltipElement}
    </div>
  );
};
