'use client'
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';

/**
 * @param {{ onLoadMore: () => void, hasMore: boolean, loading: boolean, direction?: 'down'|'up' }} props
 */
export default function InfiniteLoader({ onLoadMore, hasMore, loading, direction = 'down' }) {
  const { ref, inView } = useInView({ threshold: 0, rootMargin: '200px' });

  useEffect(() => {
    if (inView && hasMore && !loading) onLoadMore();
  }, [inView, hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-4" aria-hidden={!loading}>
      {loading && (
        <Loader2 className={`w-5 h-5 text-primary animate-spin ${direction === 'up' ? 'rotate-180' : ''}`} />
      )}
    </div>
  );
}
