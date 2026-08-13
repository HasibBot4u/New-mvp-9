import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface SubjectCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  onClick?: () => void;
  className?: string;
  to?: string;
}

export function SubjectCard({ icon, title, subtitle, badge, onClick, className = "", to }: SubjectCardProps) {
  const inner = (
    <>
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity bg-primary" />
      <div className="text-3xl mb-3 text-primary">
        {icon}
      </div>
      <p className="font-display font-semibold">{title}</p>
      {subtitle && <p className="text-xs text-foreground-muted mt-1">{subtitle}</p>}
      {badge && <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest text-primary bg-primary/15 px-2 py-0.5 rounded-full">{badge}</span>}
    </>
  );

  const baseClasses = `relative rounded-2xl border border-white/5 bg-surface p-5 overflow-hidden group hover:border-primary/30 transition-all ${className}`;

  if (to) {
    return (
      <Link to={to} className={baseClasses} role="button" tabIndex={0}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={baseClasses} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}>
      {inner}
    </div>
  );
}
