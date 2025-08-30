'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, MessageSquare, X } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import type { Highlight } from '@/types';

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
  selectedText: string;
  onHighlight: (color: string) => void;
  onClose: () => void;
}

interface NoteDialogProps {
  isOpen: boolean;
  highlightText: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'yellow', class: 'bg-yellow-200 hover:bg-yellow-300' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-200 hover:bg-blue-300' },
  { name: 'Green', value: 'green', class: 'bg-green-200 hover:bg-green-300' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-200 hover:bg-pink-300' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-200 hover:bg-purple-300' },
];

function HighlightPopover({ x, y, selectedText, onHighlight, onClose }: HighlightPopoverProps) {
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

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 280);
  const adjustedY = y > window.innerHeight / 2 ? y - 80 : y + 20;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Palette className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-medium text-gray-700">Highlight</span>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-gray-100"
        >
          <X className="h-3 w-3 text-gray-400" />
        </button>
      </div>
      
      <div className="flex gap-1 mb-2">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onHighlight(color.value)}
            className={cn(
              'w-8 h-8 rounded-full border-2 border-transparent hover:border-gray-400 transition-all',
              color.class
            )}
            title={`Highlight in ${color.name}`}
          />
        ))}
      </div>
      
      <p className="text-xs text-gray-500 max-w-60 truncate">
        "{selectedText}"
      </p>
    </div>
  );
}

function NoteDialog({ isOpen, highlightText, onSave, onClose }: NoteDialogProps) {
  const [note, setNote] = useState('');

  const handleSave = () => {
    onSave(note.trim());
    setNote('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Add Note</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Highlighted text:</p>
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <p className="text-sm italic">"{highlightText}"</p>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your note:
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your thoughts, questions, or insights..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

interface TextHighlighterProps {
  children: React.ReactNode;
  onHighlightCreate?: (highlight: LocalHighlight) => void;
  highlights?: Highlight[];
}

export default function TextHighlighter({ children, onHighlightCreate, highlights = [] }: TextHighlighterProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<Partial<LocalHighlight> | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelection = useCallback(() => {
    const currentSelection = window.getSelection();
    
    if (currentSelection && currentSelection.toString().trim().length > 0) {
      const text = currentSelection.toString().trim();
      
      // Check if selection is within our container
      const range = currentSelection.getRangeAt(0);
      if (containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        
        setSelection(currentSelection);
        setSelectedText(text);
        setPopoverPosition({
          x: rect.left + (rect.width / 2) - 140, // Center popover
          y: rect.top + window.scrollY - 10
        });
        setShowPopover(true);
      }
    } else {
      setShowPopover(false);
    }
  }, []);

  const handleHighlight = (color: string) => {
    if (!selection || !selectedText) return;

    const range = selection.getRangeAt(0);
    const highlight: LocalHighlight = {
      id: generateId(),
      text: selectedText,
      color,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      createdAt: new Date()
    };

    // Ask if user wants to add a note
    setPendingHighlight(highlight);
    setShowNoteDialog(true);
    setShowPopover(false);

    // Clear selection
    selection.removeAllRanges();
    setSelection(null);
  };

  const handleNoteDialogSave = (note: string) => {
    if (pendingHighlight && onHighlightCreate) {
      const highlight: LocalHighlight = {
        ...pendingHighlight,
        note: note || undefined
      } as LocalHighlight;
      
      onHighlightCreate(highlight);
    }
    setPendingHighlight(null);
  };

  const getHighlightClass = (color: string) => {
    const colorClasses = {
      yellow: 'bg-yellow-200',
      blue: 'bg-blue-200',
      green: 'bg-green-200',
      pink: 'bg-pink-200',
      purple: 'bg-purple-200',
    };
    return colorClasses[color as keyof typeof colorClasses] || 'bg-yellow-200';
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [handleSelection]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      
      {showPopover && (
        <HighlightPopover
          x={popoverPosition.x}
          y={popoverPosition.y}
          selectedText={selectedText}
          onHighlight={handleHighlight}
          onClose={() => setShowPopover(false)}
        />
      )}
      
      <NoteDialog
        isOpen={showNoteDialog}
        highlightText={pendingHighlight?.text || ''}
        onSave={handleNoteDialogSave}
        onClose={() => {
          setShowNoteDialog(false);
          setPendingHighlight(null);
        }}
      />
    </div>
  );
}