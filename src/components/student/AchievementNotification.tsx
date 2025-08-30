'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Star, X, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Achievement, AchievementRarity } from '@/types';

interface AchievementNotificationProps {
  achievement: Achievement;
  xpAwarded: number;
  bonusPoints?: number;
  onClose: () => void;
  isVisible: boolean;
}

const rarityConfig: Record<AchievementRarity, { 
  color: string; 
  bgColor: string; 
  textColor: string;
  glow: string;
}> = {
  common: { 
    color: 'border-gray-300', 
    bgColor: 'bg-gray-50', 
    textColor: 'text-gray-600',
    glow: 'shadow-lg'
  },
  rare: { 
    color: 'border-blue-300', 
    bgColor: 'bg-blue-50', 
    textColor: 'text-blue-600',
    glow: 'shadow-blue-200 shadow-xl'
  },
  epic: { 
    color: 'border-purple-300', 
    bgColor: 'bg-purple-50', 
    textColor: 'text-purple-600',
    glow: 'shadow-purple-200 shadow-xl'
  },
  legendary: { 
    color: 'border-yellow-300', 
    bgColor: 'bg-yellow-50', 
    textColor: 'text-yellow-600',
    glow: 'shadow-yellow-200 shadow-2xl'
  }
};

export default function AchievementNotification({
  achievement,
  xpAwarded,
  bonusPoints,
  onClose,
  isVisible
}: AchievementNotificationProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Auto-close after 5 seconds for non-legendary achievements
      if (achievement.rarity !== 'legendary') {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      // Delay unmounting for exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, achievement.rarity, onClose]);

  if (!mounted || !shouldRender) return null;

  const rarityInfo = rarityConfig[achievement.rarity];

  const notificationContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      
      {/* Notification Card */}
      <div
        className={cn(
          'relative max-w-sm w-full bg-white border-2 rounded-2xl p-6 transform transition-all duration-300',
          rarityInfo.color,
          rarityInfo.glow,
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Achievement Unlocked Header */}
        <div className="text-center mb-4">
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
            rarityInfo.bgColor,
            rarityInfo.textColor
          )}>
            <Trophy className="h-4 w-4" />
            Achievement Unlocked!
          </div>
        </div>

        {/* Achievement Details */}
        <div className="text-center">
          {/* Icon */}
          <div className={cn(
            'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
            rarityInfo.bgColor
          )}>
            <Trophy className={cn('h-8 w-8', rarityInfo.textColor)} />
          </div>

          {/* Name and Description */}
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {achievement.name}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {achievement.description}
          </p>

          {/* Rarity Badge */}
          <div className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-4',
            rarityInfo.bgColor,
            rarityInfo.textColor
          )}>
            {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)} Achievement
          </div>

          {/* Rewards */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {xpAwarded > 0 && (
              <div className="flex items-center gap-1 text-blue-600">
                <Star className="h-4 w-4" />
                <span className="text-sm font-medium">+{xpAwarded} XP</span>
              </div>
            )}
            
            {bonusPoints && bonusPoints > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <Gift className="h-4 w-4" />
                <span className="text-sm font-medium">+{bonusPoints} Points</span>
              </div>
            )}
          </div>

          {/* Celebration Message */}
          <div className="text-xs text-gray-500">
            {achievement.rarity === 'legendary' ? '🎉 Incredible achievement! You\'re among the elite!' :
             achievement.rarity === 'epic' ? '🌟 Amazing work! This is a rare accomplishment!' :
             achievement.rarity === 'rare' ? '✨ Great job! Keep up the excellent work!' :
             '👍 Well done! Every achievement counts!'}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(notificationContent, document.body);
}

interface AchievementToastProps {
  achievement: Achievement;
  xpAwarded: number;
  bonusPoints?: number;
  onClose: () => void;
  isVisible: boolean;
}

export function AchievementToast({
  achievement,
  xpAwarded,
  bonusPoints,
  onClose,
  isVisible
}: AchievementToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!mounted) return null;

  const rarityInfo = rarityConfig[achievement.rarity];

  const toastContent = (
    <div className={cn(
      'fixed top-4 right-4 z-[9998] max-w-sm w-full transform transition-all duration-300',
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    )}>
      <div className={cn(
        'bg-white border-2 rounded-lg p-4 shadow-lg',
        rarityInfo.color,
        rarityInfo.glow
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            rarityInfo.bgColor
          )}>
            <Trophy className={cn('h-5 w-5', rarityInfo.textColor)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {achievement.name}
              </p>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-600 mb-2">
              Achievement unlocked!
            </p>
            
            <div className="flex items-center gap-3">
              {xpAwarded > 0 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Star className="h-3 w-3" />
                  <span className="text-xs">+{xpAwarded}</span>
                </div>
              )}
              
              {bonusPoints && bonusPoints > 0 && (
                <div className="flex items-center gap-1 text-green-600">
                  <Gift className="h-3 w-3" />
                  <span className="text-xs">+{bonusPoints}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
}

// Hook to manage achievement notifications
export function useAchievementNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    achievement: Achievement;
    xpAwarded: number;
    bonusPoints?: number;
    type: 'modal' | 'toast';
  }>>([]);

  const showAchievementNotification = (
    achievement: Achievement,
    xpAwarded: number,
    bonusPoints?: number,
    type: 'modal' | 'toast' = achievement.rarity === 'legendary' || achievement.rarity === 'epic' ? 'modal' : 'toast'
  ) => {
    const id = `${achievement.id}-${Date.now()}`;
    setNotifications(prev => [...prev, {
      id,
      achievement,
      xpAwarded,
      bonusPoints,
      type
    }]);
  };

  const closeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return {
    notifications,
    showAchievementNotification,
    closeNotification
  };
}