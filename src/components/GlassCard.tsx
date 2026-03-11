import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: React.ReactNode;
}

export default function GlassCard({ hover = true, className, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 md:p-6',
        hover && 'glass-card-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
