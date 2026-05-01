import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface SubjectCardProps {
  name: string;
  videoCount: number;
  gradientFrom: string;
  gradientTo: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  name,
  videoCount,
  gradientFrom,
  gradientTo,
  icon,
  onClick
}) => {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl cursor-pointer shadow-md group`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-90`} />
      
      {/* Background Pattern */}
      <div className="absolute -right-10 -top-10 opacity-10 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
        {icon}
      </div>

      <div className="relative p-6 flex flex-col h-full min-h-[200px] text-white">
        <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4">
          {icon}
        </div>
        
        <h3 className="text-2xl font-bold bangla mb-2">{name}</h3>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium bangla">
            {videoCount} ভিডিও
          </span>
          <div className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center transform group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
