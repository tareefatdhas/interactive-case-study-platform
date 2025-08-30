'use client';

import { useState, useEffect } from 'react';
import { Notebook, Edit, Trash2, MessageSquare, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Highlight } from '@/types';
import { 
  getHighlightsByStudentStudent,
  updateHighlightStudent,
  deleteHighlightStudent,
  subscribeToHighlightsByStudentStudent,
} from '@/lib/firebase/student-firestore';


interface NotesTabProps {
  studentId?: string;
  sessionId?: string;
  caseStudy?: any; // Add case study for section titles
  onHighlightClick?: (highlightId: string) => void;
}

interface EditNoteDialogProps {
  isOpen: boolean;
  highlight: Highlight | null;
  onSave: (note: string) => void;
  onClose: () => void;
}

function EditNoteDialog({ isOpen, highlight, onSave, onClose }: EditNoteDialogProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (highlight) {
      setNote(highlight.note || '');
    }
  }, [highlight]);

  const handleSave = () => {
    onSave(note.trim());
    onClose();
  };

  if (!isOpen || !highlight) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Edit Note</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Highlighted text:</p>
          <div className={cn(
            'p-3 rounded border-l-4',
            getHighlightColorClass(highlight.color)
          )}>
            <p className="text-sm italic">"{highlight.text}"</p>
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

function getHighlightColorClass(color: string): string {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-400',
    blue: 'bg-blue-50 border-blue-400',
    green: 'bg-green-50 border-green-400',
    pink: 'bg-pink-50 border-pink-400',
    purple: 'bg-purple-50 border-purple-400',
  };
  return colorClasses[color as keyof typeof colorClasses] || 'bg-yellow-50 border-yellow-400';
}

function getHighlightDotClass(color: string): string {
  const colorClasses = {
    yellow: 'bg-yellow-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    pink: 'bg-pink-400',
    purple: 'bg-purple-400',
  };
  return colorClasses[color as keyof typeof colorClasses] || 'bg-yellow-400';
}

function getSectionTitle(sectionIndex: number, caseStudy: any): string {
  if (sectionIndex === -1) {
    return 'Introduction';
  }
  
  if (!caseStudy || !caseStudy.sections) {
    return `Section ${sectionIndex + 1}`;
  }
  
  const section = caseStudy.sections[sectionIndex];
  return section?.title || `Section ${sectionIndex + 1}`;
}

function groupHighlightsBySection(highlights: Highlight[], caseStudy: any) {
  const groups: { [key: number]: { title: string; highlights: Highlight[] } } = {};
  
  highlights.forEach(highlight => {
    const sectionIndex = highlight.sectionIndex ?? 0;
    if (!groups[sectionIndex]) {
      groups[sectionIndex] = {
        title: getSectionTitle(sectionIndex, caseStudy),
        highlights: []
      };
    }
    groups[sectionIndex].highlights.push(highlight);
  });
  
  // Sort groups by section index, with -1 (introduction) first
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const aIndex = parseInt(a);
    const bIndex = parseInt(b);
    if (aIndex === -1) return -1;
    if (bIndex === -1) return 1;
    return aIndex - bIndex;
  });
  
  return sortedGroups.map(([sectionIndex, group]) => ({
    sectionIndex: parseInt(sectionIndex),
    ...group
  }));
}

export default function NotesTab({ studentId, sessionId, caseStudy, onHighlightClick }: NotesTabProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (!studentId || !sessionId) return;
    // Initial load
    loadHighlights();
    // Realtime subscribe
    const unsubscribe = subscribeToHighlightsByStudentStudent(studentId, sessionId, (data) => {
      setHighlights(data.filter(h => !(h as any).deleted));
    });
    return () => unsubscribe?.();
  }, [studentId, sessionId]);

  const loadHighlights = async () => {
    if (!studentId || !sessionId) return;

    try {
      setLoading(true);
      const highlightData = await getHighlightsByStudentStudent(studentId, sessionId);
      // Filter out deleted highlights
      setHighlights(highlightData.filter(h => !(h as any).deleted));
    } catch (error) {
      console.error('Failed to load highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditNote = (highlight: Highlight) => {
    setEditingHighlight(highlight);
    setShowEditDialog(true);
  };

  const handleSaveNote = async (note: string) => {
    if (!editingHighlight) return;

    try {
      await updateHighlightStudent(editingHighlight.id, { note });
      // Update local state
      setHighlights(prev => prev.map(h => 
        h.id === editingHighlight.id ? { ...h, note } : h
      ));
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!confirm('Are you sure you want to delete this highlight?')) return;

    try {
      await deleteHighlightStudent(highlightId);
      // The real-time subscription will automatically update the UI.
      // No need for: setHighlights(prev => prev.filter(h => h.id !== highlightId));
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="text-center py-12">
        <Notebook className="h-12 w-12 mx-auto mb-4 text-gray-400 opacity-50" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">No highlights yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Start highlighting text while reading to create your first note. 
          Just select any text and choose a highlight color.
        </p>
      </div>
    );
  }

  const groupedHighlights = groupHighlightsBySection(highlights, caseStudy);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Your Notes & Highlights</h3>
        <span className="text-sm text-gray-500">
          {highlights.length} {highlights.length === 1 ? 'highlight' : 'highlights'}
        </span>
      </div>

      <div className="space-y-6">
        {groupedHighlights.map((group) => (
          <div key={group.sectionIndex} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">{group.title}</h4>
              <span className="text-xs text-gray-500">
                {group.highlights.length} {group.highlights.length === 1 ? 'highlight' : 'highlights'}
              </span>
            </div>
            
            {/* Highlights for this section */}
            {group.highlights.map((highlight) => (
          <div
            key={highlight.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            {/* Highlight header */}
            <div className="flex items-start gap-3 mb-3">
              <div 
                className={cn('w-3 h-3 rounded-full mt-1', getHighlightDotClass(highlight.color))}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(highlight.createdAt)}</span>
                </div>
                
                {/* Highlighted text */}
                <div className={cn(
                  'p-3 rounded-md mb-3 text-sm italic',
                  getHighlightColorClass(highlight.color)
                )}>
                  "{highlight.text}"
                </div>

                {/* Note */}
                {highlight.note ? (
                  <div className="bg-gray-50 rounded-md p-3 mb-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {highlight.note}
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 mb-3 italic">
                    No note added
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditNote(highlight)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                <Edit className="h-3 w-3" />
                {highlight.note ? 'Edit Note' : 'Add Note'}
              </button>
              
              {onHighlightClick && (
                <button
                  onClick={() => onHighlightClick(highlight.id)}
                  className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Jump to Text
                </button>
              )}
              
              <button
                onClick={() => handleDeleteHighlight(highlight.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors ml-auto"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </div>
            ))}
          </div>
        ))}
      </div>

      <EditNoteDialog
        isOpen={showEditDialog}
        highlight={editingHighlight}
        onSave={handleSaveNote}
        onClose={() => {
          setShowEditDialog(false);
          setEditingHighlight(null);
        }}
      />
    </div>
  );
}