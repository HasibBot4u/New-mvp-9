import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  ctaText?: string;
  ctaOnClick?: () => void;
  ctaTo?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, ctaText, ctaOnClick, ctaTo, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center border border-white/5 rounded-2xl bg-surface/50 border-dashed ${className}`}>
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-foreground-muted">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-foreground-dim text-sm max-w-sm mb-6">{description}</p>}
      
      {ctaText && ctaTo && (
        <Link to={ctaTo} data-variant="primary-cta">
          {ctaText}
        </Link>
      )}
      
      {ctaText && ctaOnClick && !ctaTo && (
        <button onClick={ctaOnClick} data-variant="primary-cta">
          {ctaText}
        </button>
      )}
    </div>
  );
}
