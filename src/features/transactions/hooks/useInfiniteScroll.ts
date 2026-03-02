import { useEffect, useRef } from 'react';

type UseInfiniteScrollOptions = {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
};

/**
 * Attaches an IntersectionObserver to a sentinel element.
 * Calls onLoadMore when the sentinel enters the viewport and more records are available.
 */
export function useInfiniteScroll({ onLoadMore, hasMore, isLoading }: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: '0px 0px 200px 0px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  return { sentinelRef };
}
