'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PopularHighlight } from '@/lib/utils/highlightAnalysis';

interface HighlightedContentProps {
  content: string;
  highlights: PopularHighlight[];
  className?: string;
  showHighlights?: boolean;
  onHighlightClick?: (highlight: PopularHighlight) => void;
}

interface ProcessedHighlight {
  text: string;
  count: number;
  students: number;
  isRecent: boolean;
  heatLevel: 'low' | 'medium' | 'high' | 'very-high';
}

/**
 * Get heat level based on count and recency
 */
function getHeatLevel(count: number, recentCount: number): 'low' | 'medium' | 'high' | 'very-high' {
  const score = count + (recentCount * 2); // Weight recent activity higher
  
  if (score >= 8) return 'very-high';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Get CSS classes for highlight heat level
 */
function getHeatClasses(heatLevel: 'low' | 'medium' | 'high' | 'very-high'): string {
  const baseClasses = 'relative rounded-md px-1.5 py-0.5 transition-all cursor-pointer group border-l-2 font-medium';
  
  switch (heatLevel) {
    case 'very-high':
      return `${baseClasses} bg-red-100/80 text-red-900 border-red-400 shadow-red-100/30 shadow-md hover:bg-red-200/80 hover:shadow-lg`;
    case 'high':
      return `${baseClasses} bg-orange-100/80 text-orange-900 border-orange-400 shadow-orange-100/30 shadow-md hover:bg-orange-200/80 hover:shadow-lg`;
    case 'medium':
      return `${baseClasses} bg-yellow-100/80 text-yellow-900 border-yellow-400 shadow-yellow-100/30 shadow-sm hover:bg-yellow-200/80`;
    case 'low':
      return `${baseClasses} bg-blue-100/60 text-blue-900 border-blue-300 hover:bg-blue-200/70`;
    default:
      return baseClasses;
  }
}

/**
 * Apply highlights to HTML content with heat-based styling
 */
function applyHighlightsToContent(content: string, highlights: PopularHighlight[]): string {
  if (!highlights.length) return content;

  let processedContent = content;

  // Sort highlights by text length (longest first) to avoid nested replacement issues
  const sortedHighlights = [...highlights]
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 15); // Limit to prevent performance issues

  sortedHighlights.forEach((highlight, index) => {
    const searchText = highlight.text.trim();
    const heatLevel = getHeatLevel(highlight.count, highlight.recentCount);
    const heatClasses = getHeatClasses(heatLevel);
    
    // Create tooltip content
    const tooltipContent = [
      `${highlight.studentIds.length} student${highlight.studentIds.length !== 1 ? 's' : ''}`,
      `${highlight.count} highlight${highlight.count !== 1 ? 's' : ''}`,
      highlight.recentCount > 0 ? `${highlight.recentCount} recent` : ''
    ].filter(Boolean).join(' • ');
    
    // Create the highlighted span with tooltip
    const highlightSpan = `<span 
      class="${heatClasses}" 
      data-tooltip="${tooltipContent}"
      data-highlight-index="${index}"
      title="${tooltipContent}"
    >${searchText}<span class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-20 shadow-lg border border-gray-700 backdrop-blur-sm">${tooltipContent}<span class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></span></span></span>`;

    // Find and replace the first occurrence that's not already inside a highlight span
    const regex = new RegExp(
      searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Escape special regex characters
      'i'
    );

    const match = processedContent.match(regex);
    if (match) {
      const beforeMatch = processedContent.substring(0, match.index!);
      const afterMatch = processedContent.substring(match.index! + match[0].length);
      
      // Check if this text is not already inside a highlight span
      const lastSpanStart = beforeMatch.lastIndexOf('<span');
      const lastSpanEnd = beforeMatch.lastIndexOf('</span>');
      
      // Only highlight if we're not already inside a highlight span
      if (lastSpanStart === -1 || lastSpanEnd > lastSpanStart) {
        processedContent = beforeMatch + highlightSpan + afterMatch;
      }
    }
  });

  return processedContent;
}

export default function HighlightedContent({
  content,
  highlights,
  className,
  showHighlights = true,
  onHighlightClick
}: HighlightedContentProps) {
  // Process highlights and generate the highlighted content
  const processedContent = useMemo(() => {
    if (!showHighlights || !highlights.length) {
      return content;
    }
    
    return applyHighlightsToContent(content, highlights);
  }, [content, highlights, showHighlights]);

  // Get highlight statistics for display
  const highlightStats = useMemo(() => {
    if (!highlights.length) return null;

    const totalHighlights = highlights.reduce((sum, h) => sum + h.count, 0);
    const uniqueStudents = new Set(highlights.flatMap(h => h.studentIds)).size;
    const recentActivity = highlights.reduce((sum, h) => sum + h.recentCount, 0);
    
    return {
      totalHighlights,
      uniqueStudents,
      recentActivity,
      popularPassages: highlights.length
    };
  }, [highlights]);

  return (
    <div className={cn('relative', className)}>
      {/* Highlight Statistics */}
      {showHighlights && highlightStats && highlightStats.totalHighlights > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/80 to-purple-50/80 border border-blue-200/50 rounded-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="text-blue-700 font-medium">
                  <strong className="text-lg">{highlightStats.totalHighlights}</strong> highlights
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                <span className="text-green-700 font-medium">
                  <strong className="text-lg">{highlightStats.uniqueStudents}</strong> student{highlightStats.uniqueStudents !== 1 ? 's' : ''}
                </span>
              </div>
              {highlightStats.recentActivity > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-sm"></div>
                  <span className="text-orange-700 font-medium">
                    <strong className="text-lg">{highlightStats.recentActivity}</strong> recent
                  </span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
              {highlightStats.popularPassages} popular passage{highlightStats.popularPassages !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Content with highlights */}
      <div 
        className="prose prose-invert prose-lg max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold"
        style={{ color: 'white' }}
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />

      {/* Legend */}
      {showHighlights && highlights.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800/20 border border-gray-700/30 rounded-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-300 font-medium">Highlight Intensity:</div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-blue-100/60 border-l-2 border-blue-300 rounded-sm shadow-sm"></div>
                <span className="text-gray-300">Few</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-yellow-100/80 border-l-2 border-yellow-400 rounded-sm shadow-sm"></div>
                <span className="text-gray-300">Some</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-orange-100/80 border-l-2 border-orange-400 rounded-sm shadow-sm"></div>
                <span className="text-gray-300">Many</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-red-100/80 border-l-2 border-red-400 rounded-sm shadow-sm"></div>
                <span className="text-gray-300">Most</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}