'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Notebook, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotesTab from './NotesTab';
import ProgressTab from './ProgressTab';
import AchievementsTab from './AchievementsTab';

interface FeaturePanelProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  sessionId?: string;
  caseStudy?: any; // Add case study for section titles
  highlights?: any[]; // Add highlights for progress stats
  currentSectionIndex?: number;
  totalSections?: number;
  totalPoints?: number;
  maxPoints?: number;
  onHighlightJump?: (highlightId: string) => void;
  teacherId?: string; // For achievements
  courseId?: string; // For achievements
}

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ label, icon, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors',
        'border-b-2 transition-all duration-200',
        isActive
          ? 'text-blue-600 border-blue-600 bg-blue-50/50'
          : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
      )}
    >
      <div className="h-5 w-5">
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

export default function FeaturePanel({ 
  isOpen, 
  onClose, 
  studentId, 
  sessionId, 
  caseStudy,
  highlights = [],
  currentSectionIndex = 0, 
  totalSections = 1,
  totalPoints = 0,
  maxPoints = 0,
  onHighlightJump,
  teacherId,
  courseId
}: FeaturePanelProps) {
  const [activeTab, setActiveTab] = useState('notes');
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'notes', label: 'Notes', icon: <Notebook className="h-full w-full" /> },
    { id: 'progress', label: 'Progress', icon: <TrendingUp className="h-full w-full" /> },
    { id: 'achievements', label: 'Achievements', icon: <Award className="h-full w-full" /> },
  ];

  // Handle swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Close if swiped down more than 100px
    if (currentY > 100) {
      onClose();
    }
    setCurrentY(0);
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative w-full bg-white rounded-t-3xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{
          height: '85vh',
          transform: `translateY(${currentY}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h2 className="text-xl font-semibold text-gray-900">Student Features</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-6 overflow-y-auto">
            {activeTab === 'notes' && (
              <NotesTab
                studentId={studentId}
                sessionId={sessionId}
                caseStudy={caseStudy}
                onHighlightClick={(highlightId) => {
                  onClose(); // Close the panel first
                  onHighlightJump?.(highlightId); // Then jump to the highlight
                }}
              />
            )}

            {activeTab === 'progress' && (
              <ProgressTab
                studentId={studentId}
                sessionId={sessionId}
                currentSectionIndex={currentSectionIndex}
                totalSections={totalSections}
                totalPoints={totalPoints}
                maxPoints={maxPoints}
                highlights={highlights}
              />
            )}

            {activeTab === 'achievements' && (
              <AchievementsTab
                studentId={studentId}
                sessionId={sessionId}
                teacherId={teacherId}
                courseId={courseId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}