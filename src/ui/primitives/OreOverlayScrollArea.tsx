import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface OreOverlayScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  autoHide?: boolean;
  hideDelayMs?: number;
  safeInsetTop?: number;
  safeInsetBottom?: number;
  safeInsetRight?: number;
  contentSafePaddingRight?: number;
}

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const MIN_THUMB_HEIGHT = 34;

export const OreOverlayScrollArea = React.forwardRef<HTMLDivElement, OreOverlayScrollAreaProps & React.HTMLAttributes<HTMLDivElement>>(({
  children,
  className = '',
  viewportClassName = '',
  contentClassName = '',
  autoHide = true,
  hideDelayMs = 900,
  safeInsetTop = 8,
  safeInsetBottom = 8,
  safeInsetRight = 6,
  contentSafePaddingRight = 18,
  onScroll,
  style,
  ...restProps
}, forwardedRef) => {
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  
  // Expose the internal viewport ref to the parent
  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalViewportRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );
  
  const getViewport = () => internalViewportRef.current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });
  const [isVisible, setIsVisible] = useState(!autoHide);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const canScroll = metrics.scrollHeight > metrics.clientHeight + 1;
  const trackHeight = Math.max(0, metrics.clientHeight - safeInsetTop - safeInsetBottom);
  const thumbHeight = canScroll
    ? Math.max(MIN_THUMB_HEIGHT, (metrics.clientHeight / metrics.scrollHeight) * trackHeight)
    : trackHeight;
  const maxScrollTop = Math.max(1, metrics.scrollHeight - metrics.clientHeight);
  const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
  const thumbTop = canScroll
    ? safeInsetTop + (metrics.scrollTop / maxScrollTop) * maxThumbTop
    : safeInsetTop;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback((force = false) => {
    clearHideTimer();
    if (!autoHide || (!force && (isHovering || isDragging))) return;
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, hideDelayMs);
  }, [autoHide, clearHideTimer, hideDelayMs, isDragging, isHovering]);

  const showScrollbar = useCallback(() => {
    clearHideTimer();
    if (canScroll) setIsVisible(true);
  }, [canScroll, clearHideTimer]);

  const updateMetrics = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    setMetrics({
      scrollTop: viewport.scrollTop,
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
    });
  }, []);

  useLayoutEffect(() => {
    updateMetrics();
  }, [children, updateMetrics]);

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    return () => resizeObserver.disconnect();
  }, [updateMetrics]);

  useEffect(() => {
    if (!canScroll) {
      setIsVisible(false);
      clearHideTimer();
      return;
    }

    if (!autoHide) setIsVisible(true);
  }, [autoHide, canScroll, clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  useEffect(() => {
    if (!isVisible) return;
    scheduleHide();
  }, [isVisible, scheduleHide]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateMetrics();
    showScrollbar();
    scheduleHide();
    if (onScroll) onScroll(e);
  };

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = getViewport();
    if (!canScroll || !viewport) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerY = event.clientY - rect.top;
    const nextRatio = Math.max(0, Math.min(1, (pointerY - thumbHeight / 2) / Math.max(1, maxThumbTop)));
    viewport.scrollTop = nextRatio * maxScrollTop;
    updateMetrics();
    showScrollbar();
  };

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = getViewport();
    if (!canScroll || !viewport) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
    };
    setIsDragging(true);
    showScrollbar();
  };

  const handleThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const viewport = getViewport();
    if (!dragState || !viewport) return;

    const deltaY = event.clientY - dragState.startY;
    const scrollDelta = (deltaY / Math.max(1, maxThumbTop)) * maxScrollTop;
    viewport.scrollTop = dragState.startScrollTop + scrollDelta;
    updateMetrics();
  };

  const handleThumbPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scheduleHide(true);
  };

  return (
    <div
      className={`ore-overlay-scrollarea ${canScroll ? 'is-scrollable' : ''} ${isVisible ? 'is-visible' : ''} ${isHovering ? 'is-hovering' : ''} ${isDragging ? 'is-dragging' : ''} ${className}`}
      onMouseEnter={() => {
        setIsHovering(true);
        showScrollbar();
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        scheduleHide(true);
      }}
      style={{
        '--ore-scroll-safe-top': `${safeInsetTop}px`,
        '--ore-scroll-safe-bottom': `${safeInsetBottom}px`,
        '--ore-scroll-safe-right': `${safeInsetRight}px`,
      } as React.CSSProperties}
    >
      <div
        ref={setViewportRef}
        className={`ore-overlay-scrollarea__viewport ${viewportClassName}`}
        onScroll={handleScroll}
        onFocusCapture={showScrollbar}
        onBlurCapture={() => scheduleHide()}
        style={style}
        {...restProps}
      >
        <div
          className={`ore-overlay-scrollarea__content ${contentClassName}`}
          style={{ paddingRight: contentSafePaddingRight }}
        >
          {children}
        </div>
      </div>

      {canScroll && (
        <div
          className="ore-overlay-scrollarea__track"
          onPointerDown={handleTrackPointerDown}
          aria-hidden="true"
        >
          <div
            className="ore-overlay-scrollarea__thumb"
            style={{
              height: thumbHeight,
              transform: `translate3d(0, ${thumbTop - safeInsetTop}px, 0)`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
      )}
    </div>
  );
});

OreOverlayScrollArea.displayName = 'OreOverlayScrollArea';

export const VirtuosoScroller = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  return (
    <OreOverlayScrollArea
      {...props}
      ref={ref}
      className={`h-full ${props.className || ''}`}
      style={props.style}
    >
      {props.children}
    </OreOverlayScrollArea>
  );
});
VirtuosoScroller.displayName = 'VirtuosoScroller';
