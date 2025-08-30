'use client';

import { useState, useEffect, useRef } from 'react';
import { Highlighter, Users, Clock, Flame, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PopularHighlight, SectionHighlightStats } from '@/lib/utils/highlightAnalysis';

interface PopularHighlightsPanelProps {
  highlights: PopularHighlight[];
  sectionStats: SectionHighlightStats[];
  currentSectionIndex: number;
  className?: string;
  onHighlightClick?: (highlight: PopularHighlight) => void;
}

interface HighlightItemProps {
  highlight: PopularHighlight;
  rank: number;
  onHighlightClick?: (highlight: PopularHighlight) => void;
}

function HighlightItem({ highlight, rank, onHighlightClick }: HighlightItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  const getHeatColor = (score: number) => {
    if (score > 100) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (score > 50) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (score > 25) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };
  
  const getMostCommonColor = () => {
    return Object.entries(highlight.colors)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'yellow';
  };
  
  const getColorClass = (color: string) => {
    const colorMap = {
      yellow: 'bg-yellow-200',
      blue: 'bg-blue-200',
      green: 'bg-green-200',
      pink: 'bg-pink-200',
      purple: 'bg-purple-200',
    };
    return colorMap[color as keyof typeof colorMap] || 'bg-yellow-200';
  };
  
  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      getHeatColor(highlight.heatScore)
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 text-xs font-bold text-white">
            {rank}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>{highlight.studentIds.length} student{highlight.studentIds.length !== 1 ? 's' : ''}</span>
            {highlight.recentCount > 0 && (
              <>
                <Clock className="w-3 h-3 ml-2" />
                <span className="text-green-400">{highlight.recentCount} recent</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <Flame className="w-3 h-3" />
            <span>{Math.round(highlight.heatScore)}</span>
          </div>
          {onHighlightClick && (
            <button
              onClick={() => onHighlightClick(highlight)}
              className="p-1 rounded hover:bg-gray-700/50 transition-colors"
              title="Scroll to highlight in content"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      {/* Highlighted text */}
      <div className={cn(
        'p-3 rounded-lg mb-3 text-sm text-gray-900 leading-relaxed',
        getColorClass(getMostCommonColor())
      )}>
        "{highlight.text}"
      </div>
      
      {/* Expand/collapse details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        View details
      </button>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Section:</span>
            <span className="text-gray-300">{highlight.sectionTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">First highlighted:</span>
            <span className="text-gray-300">
              {highlight.firstHighlightedAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Last highlighted:</span>
            <span className="text-gray-300">
              {highlight.lastHighlightedAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          
          {/* Color distribution */}
          <div className="mt-2">
            <div className="text-gray-400 mb-1">Colors used:</div>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(highlight.colors).map(([color, count]) => (
                <div
                  key={color}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/50"
                >
                  <div className={cn('w-2 h-2 rounded-full', getColorClass(color))} />
                  <span className="text-gray-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PopularHighlightsPanel({
  highlights,
  sectionStats,
  currentSectionIndex,
  className,
  onHighlightClick
}: PopularHighlightsPanelProps) {
  const [showAllSections, setShowAllSections] = useState(false);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Filter highlights for current section if not showing all
  const displayHighlights = showAllSections 
    ? highlights 
    : highlights.filter(h => h.sectionIndex === currentSectionIndex);
    
  const currentSectionStats = sectionStats.find(s => s.sectionIndex === currentSectionIndex);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panelRef.current?.contains(document.activeElement)) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedHighlightIndex(prev => 
            Math.min(displayHighlights.length - 1, prev + 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedHighlightIndex(prev => Math.max(0, prev - 1));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (displayHighlights[selectedHighlightIndex] && onHighlightClick) {
            onHighlightClick(displayHighlights[selectedHighlightIndex]);
          }
          break;
        case 'Tab':
          if (e.shiftKey) {
            setShowAllSections(!showAllSections);
            e.preventDefault();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [displayHighlights, selectedHighlightIndex, showAllSections, onHighlightClick]);
  
  // Reset selected index when highlights change
  useEffect(() => {
    setSelectedHighlightIndex(0);
  }, [showAllSections, currentSectionIndex]);
  
  return (
    <div 
      ref={panelRef}
      className={cn('bg-gray-800/50 rounded-3xl border border-gray-700/50 p-6', className)}
      tabIndex={0}
      role="listbox"
      aria-label="Popular highlights navigation"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-light text-white flex items-center">
            <Highlighter className="w-5 h-5 mr-2" />
            Popular Highlights
          </h3>
          
          <button
            onClick={() => setShowAllSections(!showAllSections)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              showAllSections
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            {showAllSections ? 'Current Section' : 'All Sections'}
            <span className="hidden sm:inline text-xs opacity-70 ml-2">
              (Shift+Tab)
            </span>
          </button>
        </div>
        
        {/* Current section stats */}
        {!showAllSections && currentSectionStats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-gray-800/30">
              <div className="text-lg font-semibold text-blue-400">
                {currentSectionStats.totalHighlights}
              </div>
              <div className="text-xs text-gray-400">Highlights</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-800/30">
              <div className="text-lg font-semibold text-green-400">
                {currentSectionStats.uniqueStudents}
              </div>
              <div className="text-xs text-gray-400">Students</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-800/30">
              <div className="text-lg font-semibold text-orange-400">
                {currentSectionStats.recentActivity}
              </div>
              <div className="text-xs text-gray-400">Recent</div>
            </div>
          </div>
        )}
        
        <div className="text-sm text-gray-400">
          {displayHighlights.length === 0 ? (
            showAllSections 
              ? 'No highlights yet in this session'
              : 'No highlights yet in this section'
          ) : (
            `Showing ${displayHighlights.length} most popular highlight${displayHighlights.length !== 1 ? 's' : ''}`
          )}
        </div>
      </div>
      
      {/* Highlights list */}
      {displayHighlights.length > 0 ? (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {displayHighlights.slice(0, 10).map((highlight, index) => (
            <div
              key={`${highlight.text}-${highlight.sectionIndex}`}
              className={cn(
                'transition-all',
                selectedHighlightIndex === index && 'ring-2 ring-blue-500/50 rounded-xl'
              )}
            >
              <HighlightItem
                highlight={highlight}
                rank={index + 1}
                onHighlightClick={onHighlightClick}
              />
            </div>
          ))}
          
          {displayHighlights.length > 10 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              +{displayHighlights.length - 10} more highlights
            </div>
          )}
          
          {/* Keyboard navigation hints */}
          {displayHighlights.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700/30">
              <div className="text-xs text-gray-500 text-center">
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">↑↓</kbd> Navigate • 
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs ml-1">Enter</kbd> Jump • 
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs ml-1">Shift+Tab</kbd> Toggle view
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Highlighter className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No Highlights Yet</p>
          <p className="text-sm">
            {showAllSections 
              ? 'Students haven\'t started highlighting content'
              : 'No highlights in this section yet'
            }
          </p>
        </div>
      )}
    </div>
  );
}