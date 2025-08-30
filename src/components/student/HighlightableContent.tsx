'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import type { Highlight } from '@/types';
import { aggregateHighlights } from '@/lib/utils/highlightAnalysis';

interface LocalHighlight {
  id: string;
  text: string;
  color: string;
  note?: string;
  startOffset: number;
  endOffset: number;
  createdAt: Date;
}

interface HighlightPopoverProps {
  x: number;
  y: number;
  onHighlight: (color: string) => void;
  onClose: () => void;
}

interface DeletePopoverProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

// Note dialog removed; notes can be added/edited later from the Highlights tab

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'yellow', class: 'bg-yellow-200 hover:bg-yellow-300' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-200 hover:bg-blue-300' },
  { name: 'Green', value: 'green', class: 'bg-green-200 hover:bg-green-300' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-200 hover:bg-pink-300' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-200 hover:bg-purple-300' },
];

function HighlightPopover({ x, y, onHighlight, onClose }: HighlightPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="highlight-popover fixed z-50 bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1.5"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.preventDefault()} // Prevent text selection from being cleared
    >
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onHighlight(color.value)}
            className={cn(
              'w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform',
              color.class
            )}
            title={`Highlight in ${color.name}`}
          />
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
          title="Cancel"
        >
          <X className="h-3 w-3 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

function DeletePopover({ x, y, onDelete, onClose }: DeletePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[200px] backdrop-blur-sm"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-red-100">
          <Trash2 className="h-4 w-4 text-red-600" />
        </div>
        <p className="text-sm font-medium text-gray-900">Remove highlight?</p>
      </div>
      
      {/* Description */}
      <p className="text-xs text-gray-600 mb-4">
        This action cannot be undone.
      </p>
      
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Remove
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Cancel
        </button>
      </div>
      
      {/* Arrow pointer */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>
      </div>
    </div>
  );
}

// Note dialog removed in favor of immediate highlight creation; notes are managed in the Highlights tab

interface HighlightableContentProps {
  htmlContent: string;
  className?: string;
  onHighlightCreate?: (highlight: LocalHighlight) => void;
  onHighlightDelete?: (highlightId: string) => void;
  highlights?: Highlight[];
  // Popular highlights props (optional - for student view)
  allSessionHighlights?: Highlight[];
  currentStudentId?: string;
  currentSectionIndex?: number;
  showPopularHighlights?: boolean;
  popularityOpacity?: number;
  minimumStudents?: number;
}

export default function HighlightableContent({
  htmlContent,
  className,
  onHighlightCreate,
  onHighlightDelete,
  highlights = [],
  // Popular highlights props
  allSessionHighlights = [],
  currentStudentId = '',
  currentSectionIndex = 0,
  showPopularHighlights = false,
  popularityOpacity = 0.6,
  minimumStudents = 2
}: HighlightableContentProps) {
  console.log('🔄 HighlightableContent render', { 
    htmlLength: htmlContent.length, 
    highlightsCount: highlights.length 
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  // State for delete confirmation popover
  const [showDeletePopover, setShowDeletePopover] = useState(false);
  const [deletePopoverPosition, setDeletePopoverPosition] = useState({ x: 0, y: 0 });
  const [highlightToDelete, setHighlightToDelete] = useState<string | null>(null);
  // State for temporary highlight that's awaiting color confirmation
  const [tempHighlight, setTempHighlight] = useState<LocalHighlight | null>(null);


  // Apply highlights to the HTML content using simple text replacement
  const applyHighlights = useCallback((html: string): string => {
    console.log('🎨 applyHighlights called', { 
      htmlLength: html.length, 
      highlightsCount: highlights.length,
      hasTempHighlight: !!tempHighlight,
      showPopular: showPopularHighlights,
      popularCount: allSessionHighlights.length
    });
    
    let processedHtml = html;
    
    // First apply popular highlights (subtle background)
    if (showPopularHighlights && allSessionHighlights.length > 0) {
      const sectionHighlights = allSessionHighlights.filter(h => h.sectionIndex === currentSectionIndex);
      if (sectionHighlights.length > 0) {
        const popularHighlights = aggregateHighlights(sectionHighlights);
        
        // Filter to only show highlights from other students with minimum threshold
        const validPopular = popularHighlights
          .filter(highlight => {
            const otherStudentIds = highlight.studentIds.filter(id => id !== currentStudentId);
            return otherStudentIds.length >= minimumStudents;
          })
          .sort((a, b) => b.text.length - a.text.length) // Longest first
          .slice(0, 10); // Limit for performance
          
        validPopular.forEach((popularHighlight) => {
          const searchText = popularHighlight.text.trim();
          const otherStudentCount = popularHighlight.studentIds.filter(id => id !== currentStudentId).length;
          
          // Get popular highlight styling
          let popularClass = '';
          if (otherStudentCount >= 5) {
            popularClass = 'bg-purple-50 border-b-2 border-dotted border-purple-400';
          } else if (otherStudentCount >= 3) {
            popularClass = 'bg-indigo-50 border-b-2 border-dotted border-indigo-400';
          } else {
            popularClass = 'bg-blue-50 border-b border-dotted border-blue-400';
          }
          
          const tooltipText = `${otherStudentCount} classmate${otherStudentCount !== 1 ? 's' : ''} highlighted this`;
          const popularSpan = `<span class="${popularClass} relative group" title="${tooltipText}" style="opacity: ${popularityOpacity}">${searchText}</span>`;
          
          // Find and replace first occurrence
          const index = processedHtml.indexOf(searchText);
          if (index !== -1) {
            const beforeText = processedHtml.substring(0, index);
            const lastSpanStart = beforeText.lastIndexOf('<span');
            const lastSpanEnd = beforeText.lastIndexOf('</span>');
            
            if (lastSpanStart === -1 || lastSpanEnd > lastSpanStart) {
              processedHtml = processedHtml.substring(0, index) + 
                            popularSpan + 
                            processedHtml.substring(index + searchText.length);
            }
          }
        });
      }
    }
    
    // Then apply personal highlights (more prominent)
    const allPersonalHighlights = [...highlights];
    if (tempHighlight) {
      allPersonalHighlights.push(tempHighlight);
    }
    
    if (allPersonalHighlights.length > 0) {
      const sortedHighlights = [...allPersonalHighlights].sort((a, b) => b.text.length - a.text.length);
      
      sortedHighlights.forEach((highlight) => {
        const searchText = highlight.text;
        const highlightSpan = `<span class="${getHighlightClass(highlight.color)}" data-highlight-id="${highlight.id}">${searchText}</span>`;
        
        const index = processedHtml.indexOf(searchText);
        if (index !== -1) {
          const beforeText = processedHtml.substring(0, index);
          const lastSpanStart = beforeText.lastIndexOf('<span');
          const lastSpanEnd = beforeText.lastIndexOf('</span>');
          
          if (lastSpanStart === -1 || lastSpanEnd > lastSpanStart) {
            processedHtml = processedHtml.substring(0, index) + 
                           highlightSpan + 
                           processedHtml.substring(index + searchText.length);
          }
        }
      });
    }

    return processedHtml;
  }, [
    highlights, 
    tempHighlight, 
    showPopularHighlights, 
    allSessionHighlights, 
    currentStudentId, 
    currentSectionIndex, 
    popularityOpacity, 
    minimumStudents
  ]);

  const getHighlightClass = (color: string): string => {
    const colorClasses = {
      temp: 'bg-blue-100 border border-blue-300 rounded-sm px-0.5 text-blue-900', // Browser-like selection
      yellow: 'bg-yellow-200 rounded-sm px-0.5',
      blue: 'bg-blue-200 rounded-sm px-0.5',
      green: 'bg-green-200 rounded-sm px-0.5',
      pink: 'bg-pink-200 rounded-sm px-0.5',
      purple: 'bg-purple-200 rounded-sm px-0.5',
    };
    return colorClasses[color as keyof typeof colorClasses] || 'bg-yellow-200 rounded-sm px-0.5';
  };

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    
    // Early exit if no selection
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString().trim();
    console.log('🔍 Selection:', { text, length: text.length });
    
    // Only proceed with valid text selections
    if (text.length === 0 || text.length > 500) {
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;
    
    const isInContainer = container.contains(range.commonAncestorContainer) ||
                         container.contains(range.startContainer) ||
                         container.contains(range.endContainer);
    
    if (!isInContainer) {
      return;
    }

    // Don't interfere if selecting existing highlights
    const startElement = range.startContainer.parentElement;
    const endElement = range.endContainer.parentElement;
    if (startElement?.closest('[data-highlight-id]') || endElement?.closest('[data-highlight-id]')) {
      return;
    }

    // Immediately create a temporary blue highlight (like browser selection)
    const tempHighlightData: LocalHighlight = {
      id: generateId(),
      text: text,
      color: 'temp', // Special temporary color that looks like browser selection
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      createdAt: new Date()
    };

    // Clear selection and show temp highlight immediately
    selection.removeAllRanges();
    setTempHighlight(tempHighlightData);
    setSavedRange(range.cloneRange());
    setSelectedText(text);
    
    // Calculate popover position - always above the highlighted text
    const rect = range.getBoundingClientRect();
    const toolbarWidth = 200;
    const toolbarHeight = 40;
    const offset = 15; // Increased offset for better spacing
    
    // Center horizontally on the selection
    let x = rect.left + (rect.width / 2) - (toolbarWidth / 2);
    
    // Always position above the selection
    let y = rect.top + window.scrollY - toolbarHeight - offset;
    
    // Keep horizontally on screen
    x = Math.max(10, Math.min(x, window.innerWidth - toolbarWidth - 10));
    
    // If not enough room above, position at top of viewport
    if (y < window.scrollY + 10) {
      y = window.scrollY + 10;
    }
    
    setPopoverPosition({ x, y });
    setShowPopover(true);
    
    console.log('✅ Temp highlight created and popover shown:', { text, color: 'temp' });
  }, []);

  const handleHighlight = (color: string) => {
    if (!tempHighlight || !savedRange) return;

    // Create the final highlight with the selected color
    const finalHighlight: LocalHighlight = {
      ...tempHighlight,
      color: color, // Replace the temporary yellow with chosen color
      id: generateId() // Generate new ID for persistence
    };

    console.log('🎨 Finalizing highlight:', {
      text: tempHighlight.text,
      oldColor: tempHighlight.color,
      newColor: color
    });

    // Persist the final highlight
    if (onHighlightCreate) {
      onHighlightCreate(finalHighlight);
    }

    // Clean up temporary state
    setTempHighlight(null);
    setShowPopover(false);
    setSelectedText('');
    setSavedRange(null);
  };

  const handleClosePopover = () => {
    // Remove temporary highlight if user cancels
    setTempHighlight(null);
    setShowPopover(false);
    setSelectedText('');
    setSavedRange(null);
    
    console.log('🚫 Popover closed - temporary highlight removed');
  };

  // No temp highlights needed - highlights are applied directly from props

  // Restore selection when popover is shown
  useEffect(() => {
    if (showPopover && savedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
  }, [showPopover, savedRange]);

  // Handle highlighting interactions without interfering with selection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let selectionCheckTimeout: NodeJS.Timeout | null = null;

    // Handle existing highlight clicks for deletion
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const highlightSpan = target.closest<HTMLElement>('[data-highlight-id]');

      if (highlightSpan) {
        e.stopPropagation();
        const highlightId = highlightSpan.dataset.highlightId;
        if (highlightId) {
          const rect = highlightSpan.getBoundingClientRect();
          setHighlightToDelete(highlightId);
          setDeletePopoverPosition({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 5,
          });
          setShowDeletePopover(true);
        }
      }
    };

    // Check for selection after mouse interaction completes
    const checkForSelection = () => {
      if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
      
      selectionCheckTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0 && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const isInContainer = container.contains(range.commonAncestorContainer) ||
                               container.contains(range.startContainer) ||
                               container.contains(range.endContainer);
          
          if (isInContainer && !showPopover) {
            console.log('Auto-showing popover for selection:', text);
            handleSelection();
          }
        }
      }, 1000); // Wait 1 second after user stops selecting
    };

    // Only check for selection after mouse up (selection complete)
    const handleMouseUp = (e: MouseEvent) => {
      // Don't interfere if clicking on highlights
      const target = e.target as HTMLElement;
      if (!target.closest('[data-highlight-id]')) {
        checkForSelection();
      }
    };

    // Handle keyboard shortcut to show highlight toolbar
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + H to show highlight toolbar
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          handleSelection();
        }
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSelection, showPopover]);

  // Memoize the highlighted content to prevent constant re-rendering
  const highlightedContent = useMemo(() => {
    console.log('🔄 Regenerating highlighted content', { 
      highlightsCount: highlights.length,
      hasTempHighlight: !!tempHighlight,
      showPopular: showPopularHighlights,
      popularCount: allSessionHighlights.length
    });
    return applyHighlights(htmlContent);
  }, [
    htmlContent, 
    highlights, 
    tempHighlight, 
    showPopularHighlights, 
    allSessionHighlights, 
    currentStudentId, 
    currentSectionIndex, 
    popularityOpacity, 
    minimumStudents
  ]);

  return (
    <div 
      ref={containerRef} 
      className={`reading-content highlightable-content ${className || ''}`}
        style={{
          userSelect: 'text',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
          pointerEvents: 'auto',
          transition: 'none',
          transform: 'none',
        }}
      >
      {/* Content rendering with highlights */}
      {highlights.length === 0 && !tempHighlight && !showPopularHighlights ? (
        <div style={{ userSelect: 'text' }} dangerouslySetInnerHTML={{ __html: htmlContent }} />
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
          style={{
            userSelect: 'text',
            WebkitUserSelect: 'text', 
            MozUserSelect: 'text',
            msUserSelect: 'text',
            pointerEvents: 'auto',
            transition: 'none',
            transform: 'none',
          }}
        />
      )}
      
      {/* Restore popovers */}
      {showPopover && (
        <HighlightPopover
          x={popoverPosition.x}
          y={popoverPosition.y}
          onHighlight={handleHighlight}
          onClose={handleClosePopover}
        />
      )}

      {showDeletePopover && (
        <DeletePopover
          x={deletePopoverPosition.x}
          y={deletePopoverPosition.y}
          onDelete={() => {
            if (highlightToDelete && onHighlightDelete) {
              onHighlightDelete(highlightToDelete);
            }
            setShowDeletePopover(false);
            setHighlightToDelete(null);
          }}
          onClose={() => {
            setShowDeletePopover(false);
            setHighlightToDelete(null);
          }}
        />
      )}
    </div>
  );
}