import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  percent: number;
  label?: string;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  percent, 
  label, 
  color = 'bg-indigo-500' 
}) => {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1 bangla font-medium">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-500">{Math.round(clampedPercent)}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedPercent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};
