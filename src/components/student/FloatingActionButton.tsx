'use client';

import { useState, useEffect } from 'react';
import { Menu, Notebook, TrendingUp, Award, Sparkles, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FABState = 'default' | 'highlight' | 'progress' | 'achievement';

interface FABNotification {
  type: 'highlight' | 'progress' | 'achievement';
  count?: number;
  message?: string;
}

interface FloatingActionButtonProps {
  onClick: () => void;
  state?: FABState;
  notifications?: FABNotification[];
  suggestedTab?: string;
}

const stateConfig = {
  default: {
    icon: Menu,
    bgColor: 'bg-blue-600 hover:bg-blue-700',
    title: 'Open student features'
  },
  highlight: {
    icon: Sparkles,
    bgColor: 'bg-yellow-500 hover:bg-yellow-600',
    title: 'New highlight created! View your notes'
  },
  progress: {
    icon: TrendingUp,
    bgColor: 'bg-green-500 hover:bg-green-600',
    title: 'Progress updated! Check your achievements'
  },
  achievement: {
    icon: Award,
    bgColor: 'bg-purple-500 hover:bg-purple-600',
    title: 'New achievement unlocked!'
  }
};

export default function FloatingActionButton({ 
  onClick, 
  state = 'default', 
  notifications = [],
  suggestedTab 
}: FloatingActionButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  const config = stateConfig[state];
  const IconComponent = config.icon;
  const hasNotifications = notifications.length > 0;
  const totalNotifications = notifications.reduce((sum, n) => sum + (n.count || 1), 0);

  // Trigger animation when state changes or notifications appear
  useEffect(() => {
    if (state !== 'default' || hasNotifications) {
      setIsAnimating(true);
      setShowPulse(true);
      
      // Reset animation after duration
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 600);

      // Keep pulse for longer to draw attention
      const pulseTimer = setTimeout(() => {
        setShowPulse(false);
      }, 3000);

      return () => {
        clearTimeout(timer);
        clearTimeout(pulseTimer);
      };
    }
  }, [state, hasNotifications, totalNotifications]);

  const handleClick = () => {
    // Reset visual states when clicked
    setShowPulse(false);
    setIsAnimating(false);
    onClick();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Pulse ring animation */}
      {showPulse && (
        <div className="absolute inset-0 rounded-full animate-ping">
          <div className={cn(
            'h-14 w-14 rounded-full opacity-75',
            state === 'highlight' && 'bg-yellow-400',
            state === 'progress' && 'bg-green-400',
            state === 'achievement' && 'bg-purple-400',
            state === 'default' && hasNotifications && 'bg-blue-400'
          )} />
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={handleClick}
        className={cn(
          'relative h-14 w-14 rounded-full text-white shadow-lg transition-all duration-300 ease-in-out active:scale-95',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          config.bgColor,
          state === 'default' && 'focus:ring-blue-500',
          state === 'highlight' && 'focus:ring-yellow-500',
          state === 'progress' && 'focus:ring-green-500',
          state === 'achievement' && 'focus:ring-purple-500',
          isAnimating && 'animate-bounce',
          showPulse ? 'scale-110' : 'hover:scale-105'
        )}
        title={config.title}
        aria-label={config.title}
      >
        <IconComponent className={cn(
          'h-6 w-6 transition-transform duration-300',
          isAnimating && 'scale-110'
        )} />

        {/* Notification badge */}
        {hasNotifications && (
          <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <span className="text-xs font-bold text-white">
              {totalNotifications > 9 ? '9+' : totalNotifications}
            </span>
          </div>
        )}

        {/* Sparkle effect for achievements */}
        {state === 'achievement' && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute top-1 right-2 w-1 h-1 bg-white rounded-full animate-ping" 
                 style={{ animationDelay: '0ms' }} />
            <div className="absolute top-3 left-1 w-1 h-1 bg-white rounded-full animate-ping" 
                 style={{ animationDelay: '200ms' }} />
            <div className="absolute bottom-2 right-1 w-1 h-1 bg-white rounded-full animate-ping" 
                 style={{ animationDelay: '400ms' }} />
          </div>
        )}
      </button>

      {/* Floating notification tooltip */}
      {hasNotifications && notifications[0]?.message && (
        <div className="absolute bottom-16 right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg max-w-48 animate-fade-in">
          <div className="relative">
            {notifications[0].message}
            {/* Arrow pointing to FAB */}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}