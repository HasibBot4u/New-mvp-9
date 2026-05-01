import { Link } from "react-router-dom";

interface NexusLogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
}

export function NexusLogo({ size = "md", href = "/" }: NexusLogoProps) {
  const dim = size === "sm" ? "h-7" : size === "lg" ? "h-10" : "h-8";
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";

  const inner = (
    <div className="flex items-center gap-2.5 group">
      <div className={`${dim} aspect-square relative`}>
        <div className="absolute inset-0 rounded-lg bg-gradient-primary group-hover:shadow-glow transition-shadow duration-500" />
        <div className="absolute inset-[2px] rounded-[6px] bg-background flex items-center justify-center">
          <span className="font-display font-bold text-gradient-primary text-base">N</span>
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display font-bold tracking-tight ${text}`}>
          Nexus<span className="text-primary">Edu</span>
        </span>
      </div>
    </div>
  );

  return href ? <Link to={href}>{inner}</Link> : inner;
}
