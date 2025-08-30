'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Highlight } from '@/types';
import { aggregateHighlights, type PopularHighlight } from '@/lib/utils/highlightAnalysis';

interface PopularHighlightsIndicatorProps {
  htmlContent: string;
  allSessionHighlights: Highlight[];
  currentStudentId: string;
  currentSectionIndex: number;
  className?: string;
  showPopularHighlights?: boolean;
  popularityOpacity?: number; // 0.3 to 1.0
  minimumStudents?: number; // Minimum students before showing as popular (default: 2)
}

/**
 * Get CSS classes for popular highlight styling (subtle for students)
 */
function getPopularHighlightClasses(
  studentCount: number, 
  minimumStudents: number
): string {
  if (studentCount < minimumStudents) return '';
  
  // Different intensity levels based on student count
  if (studentCount >= 5) {
    return `relative border-b-2 border-dotted border-purple-400 bg-purple-50 transition-all duration-200 hover:bg-purple-100`;
  } else if (studentCount >= 3) {
    return `relative border-b-2 border-dotted border-indigo-400 bg-indigo-50 transition-all duration-200 hover:bg-indigo-100`;
  } else {
    return `relative border-b border-dotted border-blue-400 bg-blue-50 transition-all duration-200 hover:bg-blue-100`;
  }
}

/**
 * Apply popular highlights to HTML content (excluding current student's highlights)
 */
function applyPopularHighlights(
  content: string, 
  popularHighlights: PopularHighlight[],
  currentStudentId: string,
  minimumStudents: number,
  opacity: number
): string {
  if (!popularHighlights.length) return content;

  let processedContent = content;

  // Filter and sort popular highlights (excluding those only from current student)
  const validPopularHighlights = popularHighlights
    .filter(highlight => {
      // Only show if minimum students met AND it's not just the current student
      const otherStudentIds = highlight.studentIds.filter(id => id !== currentStudentId);
      return otherStudentIds.length >= minimumStudents;
    })
    .sort((a, b) => b.text.length - a.text.length) // Longest first to avoid nesting
    .slice(0, 10); // Limit to prevent performance issues

  validPopularHighlights.forEach((highlight, index) => {
    const searchText = highlight.text.trim();
    const otherStudentIds = highlight.studentIds.filter(id => id !== currentStudentId);
    const studentCount = otherStudentIds.length;
    
    const highlightClasses = getPopularHighlightClasses(studentCount, minimumStudents);
    
    if (!highlightClasses) return; // Skip if below threshold
    
    // Create tooltip content (anonymous)
    const tooltipContent = `${studentCount} classmate${studentCount !== 1 ? 's' : ''} highlighted this`;
    
    // Create the popular highlight span
    const highlightSpan = `<span 
      class="${highlightClasses}" 
      data-popular-tooltip="${tooltipContent}"
      data-popular-count="${studentCount}"
      data-popular-index="${index}"
      title="${tooltipContent}"
      style="opacity: ${opacity}"
    >${searchText}<span class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">${tooltipContent}</span></span>`;

    // Find and replace first occurrence (similar to teacher implementation but more careful)
    const regex = new RegExp(
      searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Escape special regex characters
      'i'
    );

    const match = processedContent.match(regex);
    if (match) {
      const beforeMatch = processedContent.substring(0, match.index!);
      const afterMatch = processedContent.substring(match.index! + match[0].length);
      
      // Check if this text is not already inside any highlight span
      const lastSpanStart = beforeMatch.lastIndexOf('<span');
      const lastSpanEnd = beforeMatch.lastIndexOf('</span>');
      
      // Only highlight if we're not already inside a span
      if (lastSpanStart === -1 || lastSpanEnd > lastSpanStart) {
        processedContent = beforeMatch + highlightSpan + afterMatch;
      }
    }
  });

  return processedContent;
}

export default function PopularHighlightsIndicator({
  htmlContent,
  allSessionHighlights,
  currentStudentId,
  currentSectionIndex,
  className,
  showPopularHighlights = false,
  popularityOpacity = 0.6,
  minimumStudents = 2
}: PopularHighlightsIndicatorProps) {
  // Process popular highlights for current section
  const processedContent = useMemo(() => {
    if (!showPopularHighlights || !allSessionHighlights.length) {
      return htmlContent;
    }

    // Filter highlights for current section only
    const sectionHighlights = allSessionHighlights.filter(h => h.sectionIndex === currentSectionIndex);
    
    if (!sectionHighlights.length) return htmlContent;

    // Aggregate to find popular passages
    const popularHighlights = aggregateHighlights(sectionHighlights);
    
    // Apply popular highlights to content
    return applyPopularHighlights(
      htmlContent, 
      popularHighlights, 
      currentStudentId, 
      minimumStudents, 
      popularityOpacity
    );
  }, [
    htmlContent, 
    allSessionHighlights, 
    currentStudentId, 
    currentSectionIndex, 
    showPopularHighlights, 
    popularityOpacity, 
    minimumStudents
  ]);

  // Get statistics for display
  const popularStats = useMemo(() => {
    if (!showPopularHighlights || !allSessionHighlights.length) return null;

    const sectionHighlights = allSessionHighlights.filter(h => h.sectionIndex === currentSectionIndex);
    const popularHighlights = aggregateHighlights(sectionHighlights);
    
    const validPopularHighlights = popularHighlights.filter(highlight => {
      const otherStudentIds = highlight.studentIds.filter(id => id !== currentStudentId);
      return otherStudentIds.length >= minimumStudents;
    });

    if (!validPopularHighlights.length) return null;

    const totalClassmates = new Set(
      sectionHighlights
        .filter(h => h.studentId !== currentStudentId)
        .map(h => h.studentId)
    ).size;

    return {
      popularPassages: validPopularHighlights.length,
      totalClassmates,
      mostPopular: validPopularHighlights[0]?.studentIds.filter(id => id !== currentStudentId).length || 0
    };
  }, [allSessionHighlights, currentStudentId, currentSectionIndex, showPopularHighlights, minimumStudents]);

  return (
    <div className={cn('relative', className)}>
      {/* Popular highlights statistics (subtle) */}
      {showPopularHighlights && popularStats && popularStats.popularPassages > 0 && (
        <div className="mb-4 p-3 bg-purple-50/80 border border-purple-200/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-purple-700 font-medium">
                {popularStats.popularPassages} popular passage{popularStats.popularPassages !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-xs text-purple-600">
              {popularStats.totalClassmates} classmate{popularStats.totalClassmates !== 1 ? 's' : ''} active
            </div>
          </div>
        </div>
      )}

      {/* Content with popular highlights overlay */}
      <div 
        className="prose max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />

      {/* Subtle legend for popular highlights */}
      {showPopularHighlights && popularStats && popularStats.popularPassages > 0 && (
        <div className="mt-4 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 text-center">
            <span className="font-medium">Popular with classmates:</span>
            <span className="ml-2 border-b border-dotted border-blue-400 bg-blue-50 px-1 py-0.5">Few</span>
            <span className="ml-1 border-b-2 border-dotted border-indigo-400 bg-indigo-50 px-1 py-0.5">Some</span>
            <span className="ml-1 border-b-2 border-dotted border-purple-400 bg-purple-50 px-1 py-0.5">Many</span>
          </div>
        </div>
      )}
    </div>
  );
}