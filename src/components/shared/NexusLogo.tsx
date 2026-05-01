import React from 'react';
import { Link } from 'react-router-dom';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';

interface NexusLogoProps {
  className?: string;
  withSubtitle?: boolean;
}

export const NexusLogo: React.FC<NexusLogoProps> = ({ className = '', withSubtitle = true }) => {
  const { settings } = useSystemSettings();
  const brandName = settings?.platform_name || 'NexusEdu';

  return (
    <Link to="/" className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-8 h-8 bg-primary rounded-lg shadow-sm">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <span className="text-2xl font-bold text-primary-dark tracking-tight">
          {brandName}
        </span>
      </div>
      {withSubtitle && (
        <span className="text-xs text-accent font-medium mt-0.5 bangla ml-10">
          তোমার শিক্ষার নতুন দিগন্ত
        </span>
      )}
    </Link>
  );
};
