import { cn } from '@/lib/utils';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card rounded-xl p-4 md:p-6 space-y-3', className)}>
      <div className="h-4 w-1/3 skeleton-glass rounded" />
      <div className="h-8 w-2/3 skeleton-glass rounded" />
      <div className="h-3 w-1/2 skeleton-glass rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card rounded-xl p-4 md:p-6 space-y-2">
      <div className="h-4 w-1/4 skeleton-glass rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-4 flex-1 skeleton-glass rounded" />
          <div className="h-4 w-20 skeleton-glass rounded" />
          <div className="h-4 w-24 skeleton-glass rounded" />
        </div>
      ))}
    </div>
  );
}
