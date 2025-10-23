// src/hooks/useResizeObserver.ts
import { useState, useLayoutEffect, RefObject } from 'react';

export function useResizeObserver(ref: RefObject<HTMLElement>) {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      // Hanya update jika tinggi benar-benar berubah
      const newHeight = entries[0]?.contentRect.height;
      if (newHeight && newHeight !== height) {
        setHeight(newHeight);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, height]); // Tambahkan height sebagai dependensi untuk re-observe jika perlu

  return height;
}
