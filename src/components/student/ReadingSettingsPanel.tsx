'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Users, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadingSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  showPopularHighlights: boolean;
  onTogglePopularHighlights: (enabled: boolean) => void;
  popularityOpacity: number;
  onOpacityChange: (opacity: number) => void;
  minimumStudents: number;
  onMinimumStudentsChange: (count: number) => void;
  className?: string;
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

function Toggle({ enabled, onChange, label, description, icon }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="mt-1 p-1 rounded-md bg-gray-100">
          {icon}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">{label}</h4>
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          </div>
          <button
            onClick={() => onChange(!enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  description: string;
  formatValue: (value: number) => string;
  disabled?: boolean;
}

function Slider({ value, onChange, min, max, step, label, description, formatValue, disabled }: SliderProps) {
  return (
    <div className={cn('space-y-2', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">{label}</h4>
        <span className="text-sm font-medium text-blue-600">{formatValue(value)}</span>
      </div>
      <p className="text-xs text-gray-600">{description}</p>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={cn(
            'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        />
      </div>
    </div>
  );
}

export default function ReadingSettingsPanel({
  isOpen,
  onClose,
  showPopularHighlights,
  onTogglePopularHighlights,
  popularityOpacity,
  onOpacityChange,
  minimumStudents,
  onMinimumStudentsChange,
  className
}: ReadingSettingsPanelProps) {
  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('student-reading-settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.showPopularHighlights !== undefined) {
            onTogglePopularHighlights(settings.showPopularHighlights);
          }
          if (settings.popularityOpacity !== undefined) {
            onOpacityChange(settings.popularityOpacity);
          }
          if (settings.minimumStudents !== undefined) {
            onMinimumStudentsChange(settings.minimumStudents);
          }
        } catch (error) {
          console.error('Failed to load reading settings:', error);
        }
      }
    }
  }, [onTogglePopularHighlights, onOpacityChange, onMinimumStudentsChange]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const settings = {
        showPopularHighlights,
        popularityOpacity,
        minimumStudents
      };
      localStorage.setItem('student-reading-settings', JSON.stringify(settings));
    }
  }, [showPopularHighlights, popularityOpacity, minimumStudents]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={cn(
        'relative w-full sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl',
        'transition-transform duration-300 ease-out',
        'flex flex-col max-h-[80vh]',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Reading Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Popular Highlights Toggle */}
          <Toggle
            enabled={showPopularHighlights}
            onChange={onTogglePopularHighlights}
            label="Show Popular Highlights"
            description="See passages that your classmates have highlighted (anonymous)"
            icon={<Users className="w-4 h-4 text-gray-600" />}
          />

          {/* Opacity Slider */}
          <Slider
            value={popularityOpacity}
            onChange={onOpacityChange}
            min={0.3}
            max={1.0}
            step={0.1}
            label="Highlight Intensity"
            description="How prominent popular highlights appear"
            formatValue={(value) => `${Math.round(value * 100)}%`}
            disabled={!showPopularHighlights}
          />

          {/* Minimum Students Slider */}
          <Slider
            value={minimumStudents}
            onChange={onMinimumStudentsChange}
            min={2}
            max={5}
            step={1}
            label="Minimum Classmates"
            description="How many classmates must highlight before showing as popular"
            formatValue={(value) => `${value} student${value !== 1 ? 's' : ''}`}
            disabled={!showPopularHighlights}
          />

          {/* Privacy Notice */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">Privacy Protected</h4>
                <p className="text-xs text-blue-700">
                  Popular highlights are anonymous - you won't see who highlighted what, 
                  just how many of your classmates found each passage interesting.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Settings saved automatically</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Ready to read</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}