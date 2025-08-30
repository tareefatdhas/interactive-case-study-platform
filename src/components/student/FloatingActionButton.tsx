'use client';

import { useState, useEffect } from 'react';
import { Menu, Notebook, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
}

export default function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  // Always keep the FAB visible - no scroll hiding behavior

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 ease-in-out hover:bg-blue-700 hover:scale-105 active:scale-95',
        'flex items-center justify-center',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      )}
      title="Open student features"
      aria-label="Open student features menu"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}