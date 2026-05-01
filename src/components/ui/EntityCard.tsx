import * as React from "react";
import { cn } from "@/lib/utils";

interface EntityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function EntityCard({ icon, title, subtitle, badge, onClick, onEdit, onDelete, className, ...props }: EntityCardProps) {
  return (
    <div 
      className={cn(
        "group relative flex items-center justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all outline-none",
        onClick && "cursor-pointer hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      {...props}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center pointer-events-none">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold truncate leading-none">{title}</h4>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-2.5 py-1.5 h-8 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-2.5 py-1.5 h-8 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
