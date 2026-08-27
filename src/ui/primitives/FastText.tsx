// /src/ui/primitives/FastText.tsx
import React, { useRef, useEffect } from 'react';
import type { Facet } from '@react-facet/core';
import { isFacet } from '@react-facet/core';

export interface FastTextProps {
  text: Facet<string | number> | string | number;
  className?: string;
}

export const FastText: React.FC<FastTextProps> = ({ text, className = '' }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isFacet(text)) {
      if (spanRef.current) {
        spanRef.current.textContent = String(text);
      }
      return;
    }

    const unsubscribe = text.observe((value) => {
      if (spanRef.current) {
        spanRef.current.textContent = String(value);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [text]);

  const initialValue = isFacet(text) ? text.get() : text;

  return (
    <span ref={spanRef} className={className}>
      {initialValue !== undefined ? String(initialValue) : ''}
    </span>
  );
};
