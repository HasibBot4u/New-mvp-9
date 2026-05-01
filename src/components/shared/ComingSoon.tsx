import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  backPath?: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ 
  icon, 
  title, 
  description, 
  backPath 
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6">
        {icon}
      </div>
      
      <div className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium bangla mb-4">
        শীঘ্রই আসছে
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 bangla mb-3">
        {title}
      </h2>
      
      <p className="text-gray-600 max-w-md bangla mb-8">
        {description}
      </p>

      {backPath && (
        <button 
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium bangla"
        >
          <ArrowLeft className="w-4 h-4" />
          ফিরে যান
        </button>
      )}
    </div>
  );
};
