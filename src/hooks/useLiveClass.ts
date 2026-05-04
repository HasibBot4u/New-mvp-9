import { useState, useCallback } from 'react';

// For this mock, we use a placeholder interface for Live Class
export interface LiveClass {
  id: string;
  title: string;
  description: string;
  roomName: string;
  scheduledAt: string;
  durationMinutes: number;
  instructorName: string;
  status: 'scheduled' | 'live' | 'ended';
}

export function useLiveClass() {
  const [liveClasses] = useState<LiveClass[]>([
    {
      id: 'lc_1',
      title: 'Physics Q&A - Cycle 1',
      description: 'Reviewing key concepts before the major exam.',
      roomName: 'physics_cycle_1_qa',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      durationMinutes: 60,
      instructorName: 'Dr. Ahmad',
      status: 'scheduled'
    }
  ]);
  
  const [activeClass, setActiveClass] = useState<LiveClass | null>(null);

  const joinClass = useCallback((classId: string) => {
    const found = liveClasses.find(c => c.id === classId);
    if (found) {
      setActiveClass(found);
    }
  }, [liveClasses]);

  const leaveClass = useCallback(() => {
    setActiveClass(null);
  }, []);

  return {
    liveClasses,
    activeClass,
    joinClass,
    leaveClass
  };
}
