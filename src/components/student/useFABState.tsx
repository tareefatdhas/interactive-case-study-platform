'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FABState, FABNotification } from './FloatingActionButton';

interface FABStateContext {
  // Student progress data
  currentSection: number;
  totalSections: number;
  sectionCompleted: boolean;
  totalPoints: number;
  maxPoints: number;
  
  // Recent activity
  recentHighlights: number;
  recentAchievements: any[];
  
  // Session state
  hasAnsweredCurrentSection: boolean;
  progressPercentage: number;
}

interface UseFABStateReturn {
  fabState: FABState;
  notifications: FABNotification[];
  suggestedTab: string;
  clearNotifications: () => void;
  onHighlightCreated: () => void;
  onProgressMade: () => void;
  onAchievementUnlocked: (achievement: any) => void;
}

export function useFABState(context: FABStateContext): UseFABStateReturn {
  const [fabState, setFABState] = useState<FABState>('default');
  const [notifications, setNotifications] = useState<FABNotification[]>([]);
  const [suggestedTab, setSuggestedTab] = useState('notes');
  const [recentActivity, setRecentActivity] = useState({
    highlights: 0,
    achievements: [] as any[],
    lastProgressUpdate: 0
  });

  // Determine the most relevant tab based on context
  const calculateSuggestedTab = useCallback((state: FABState, context: FABStateContext) => {
    // If there are recent achievements, prioritize achievements tab
    if (recentActivity.achievements.length > 0) {
      return 'achievements';
    }
    
    // If section is completed, show progress
    if (context.sectionCompleted || context.hasAnsweredCurrentSection) {
      return 'progress';
    }
    
    // If there are recent highlights, show notes
    if (recentActivity.highlights > 0) {
      return 'notes';
    }
    
    // Default based on progress
    if (context.progressPercentage > 0) {
      return 'progress';
    }
    
    return 'notes';
  }, [recentActivity]);

  // Determine FAB state based on recent activity and context
  const calculateFABState = useCallback((context: FABStateContext) => {
    // Priority: Achievement > Progress > Highlight > Default
    
    if (recentActivity.achievements.length > 0) {
      return 'achievement';
    }
    
    if (context.sectionCompleted && Date.now() - recentActivity.lastProgressUpdate < 5000) {
      return 'progress';
    }
    
    if (recentActivity.highlights > 0) {
      return 'highlight';
    }
    
    return 'default';
  }, [recentActivity]);

  // Update FAB state when context changes
  useEffect(() => {
    const newState = calculateFABState(context);
    const newSuggestedTab = calculateSuggestedTab(newState, context);
    
    setFABState(newState);
    setSuggestedTab(newSuggestedTab);
  }, [context, calculateFABState, calculateSuggestedTab]);

  // Generate notifications based on recent activity
  useEffect(() => {
    const newNotifications: FABNotification[] = [];
    
    if (recentActivity.highlights > 0) {
      newNotifications.push({
        type: 'highlight',
        count: recentActivity.highlights,
        message: recentActivity.highlights === 1 
          ? 'New highlight added to your notes' 
          : `${recentActivity.highlights} new highlights added`
      });
    }
    
    if (context.sectionCompleted && Date.now() - recentActivity.lastProgressUpdate < 10000) {
      newNotifications.push({
        type: 'progress',
        count: 1,
        message: 'Section completed! Check your progress'
      });
    }
    
    if (recentActivity.achievements.length > 0) {
      const latestAchievement = recentActivity.achievements[recentActivity.achievements.length - 1];
      newNotifications.push({
        type: 'achievement',
        count: recentActivity.achievements.length,
        message: recentActivity.achievements.length === 1
          ? `Achievement unlocked: ${latestAchievement.title}`
          : `${recentActivity.achievements.length} new achievements!`
      });
    }
    
    setNotifications(newNotifications);
  }, [recentActivity, context.sectionCompleted]);

  // Event handlers
  const onHighlightCreated = useCallback(() => {
    setRecentActivity(prev => ({
      ...prev,
      highlights: prev.highlights + 1
    }));
    
    // Clear highlight notification after 10 seconds
    setTimeout(() => {
      setRecentActivity(prev => ({
        ...prev,
        highlights: Math.max(0, prev.highlights - 1)
      }));
    }, 10000);
  }, []);

  const onProgressMade = useCallback(() => {
    setRecentActivity(prev => ({
      ...prev,
      lastProgressUpdate: Date.now()
    }));
  }, []);

  const onAchievementUnlocked = useCallback((achievement: any) => {
    setRecentActivity(prev => ({
      ...prev,
      achievements: [...prev.achievements, achievement]
    }));
    
    // Clear achievement notification after 30 seconds
    setTimeout(() => {
      setRecentActivity(prev => ({
        ...prev,
        achievements: prev.achievements.filter(a => a.id !== achievement.id)
      }));
    }, 30000);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setRecentActivity({
      highlights: 0,
      achievements: [],
      lastProgressUpdate: 0
    });
    setFABState('default');
  }, []);

  return {
    fabState,
    notifications,
    suggestedTab,
    clearNotifications,
    onHighlightCreated,
    onProgressMade,
    onAchievementUnlocked
  };
}
