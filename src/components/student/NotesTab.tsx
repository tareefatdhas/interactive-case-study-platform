'use client';

import { useState, useEffect } from 'react';
import { 
  Notebook, 
  Edit, 
  Trash2, 
  MessageSquare, 
  Calendar, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  ExternalLink,
  Tag,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Highlight } from '@/types';
import { 
  getHighlightsByStudentStudent,
  updateHighlightStudent,
  deleteHighlightStudent,
  subscribeToHighlightsByStudentStudent,
} from '@/lib/firebase/student-firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';


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

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

type SortOption = 'date-newest' | 'date-oldest' | 'section' | 'color';
type FilterOption = 'all' | 'with-notes' | 'without-notes' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

function ConfirmDialog({ isOpen, title, message, confirmText, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <h3 id="confirm-dialog-title" className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        
        <p id="confirm-dialog-description" className="text-sm text-gray-600 mb-6">{message}</p>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="w-full sm:w-auto"
            autoFocus
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (!isOpen || !highlight) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-note-title"
      aria-describedby="edit-note-description"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h3 id="edit-note-title" className="text-lg font-semibold text-gray-900">
            {highlight.note ? 'Edit Note' : 'Add Note'}
          </h3>
        </div>
        
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Highlighted text:</p>
          <div className={cn(
            'p-4 rounded-lg border-l-4 bg-gradient-to-r',
            getHighlightColorClass(highlight.color)
          )}>
            <p className="text-sm leading-relaxed">"{highlight.text}"</p>
          </div>
        </div>
        
        <div className="mb-6">
          <label htmlFor="note-textarea" className="block text-sm font-medium text-gray-700 mb-3">
            Your note:
          </label>
          <textarea
            id="note-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your thoughts, questions, insights, or connections..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all touch-manipulation"
            rows={5}
            autoFocus
            aria-describedby="note-help"
          />
          <div id="note-help" className="text-xs text-gray-500 mt-2">
            <p>Tip: Add questions, connections to other concepts, or personal insights</p>
            <p className="mt-1">Press Cmd/Ctrl + Enter to save, Escape to cancel</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="w-full sm:w-auto"
          >
            {highlight.note ? 'Update Note' : 'Add Note'}
          </Button>
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [highlightToDelete, setHighlightToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);

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

  const handleDeleteHighlight = (highlightId: string) => {
    setHighlightToDelete(highlightId);
    setShowConfirmDialog(true);
  };

  const confirmDeleteHighlight = async () => {
    if (!highlightToDelete) return;

    try {
      await deleteHighlightStudent(highlightToDelete);
      setShowConfirmDialog(false);
      setHighlightToDelete(null);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const filterAndSortHighlights = (highlights: Highlight[]) => {
    let filtered = highlights;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(highlight => 
        highlight.text.toLowerCase().includes(query) ||
        highlight.note?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filterBy !== 'all') {
      if (filterBy === 'with-notes') {
        filtered = filtered.filter(h => h.note && h.note.trim().length > 0);
      } else if (filterBy === 'without-notes') {
        filtered = filtered.filter(h => !h.note || h.note.trim().length === 0);
      } else {
        // Color filter
        filtered = filtered.filter(h => h.color === filterBy);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-newest':
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        case 'date-oldest':
          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        case 'section':
          return (a.sectionIndex || 0) - (b.sectionIndex || 0);
        case 'color':
          return a.color.localeCompare(b.color);
        default:
          return 0;
      }
    });

    return filtered;
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

  const filteredHighlights = filterAndSortHighlights(highlights);
  const groupedHighlights = groupHighlightsBySection(filteredHighlights, caseStudy);

  if (highlights.length === 0) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-blue-50 p-4 rounded-full">
              <Notebook className="h-8 w-8 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">No highlights yet</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                Start highlighting text while reading to create your first note. 
                Just select any text and choose a highlight color to begin building your personal study notes.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-full">
              <Tag className="h-3 w-3" />
              <span>Select text → Choose color → Add notes</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Your Notes & Highlights</h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredHighlights.length} of {highlights.length} {highlights.length === 1 ? 'highlight' : 'highlights'}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className={cn('transition-all duration-200', showFilters ? 'block' : 'hidden')}>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <label htmlFor="search-highlights" className="sr-only">
              Search highlights and notes
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              id="search-highlights"
              type="text"
              placeholder="Search highlights and notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Search through your highlighted text and notes content
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Sort */}
            <div className="flex-1">
              <label htmlFor="sort-select" className="block text-sm font-medium text-gray-700 mb-1">
                Sort by
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby="sort-help"
              >
                <option value="date-newest">Newest first</option>
                <option value="date-oldest">Oldest first</option>
                <option value="section">By section</option>
                <option value="color">By color</option>
              </select>
              <div id="sort-help" className="sr-only">
                Choose how to sort your highlights and notes
              </div>
            </div>

            {/* Filter */}
            <div className="flex-1">
              <label htmlFor="filter-select" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by
              </label>
              <select
                id="filter-select"
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-describedby="filter-help"
              >
                <option value="all">All highlights</option>
                <option value="with-notes">With notes</option>
                <option value="without-notes">Without notes</option>
                <option value="yellow">Yellow highlights</option>
                <option value="blue">Blue highlights</option>
                <option value="green">Green highlights</option>
                <option value="pink">Pink highlights</option>
                <option value="purple">Purple highlights</option>
              </select>
              <div id="filter-help" className="sr-only">
                Filter highlights by type or color
              </div>
            </div>
          </div>

          {(searchQuery || filterBy !== 'all' || sortBy !== 'date-newest') && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Active filters applied</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterBy('all');
                  setSortBy('date-newest');
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Highlights Section */}
      {filteredHighlights.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center space-y-3">
              <Search className="h-8 w-8 text-gray-400" />
              <div>
                <h3 className="text-lg font-medium text-gray-600 mb-1">No matching highlights</h3>
                <p className="text-sm text-gray-500">
                  Try adjusting your search or filter criteria
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterBy('all');
                }}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedHighlights.map((group) => (
            <div key={group.sectionIndex} className="space-y-4">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-semibold text-gray-900">{group.title}</h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {group.highlights.length} {group.highlights.length === 1 ? 'highlight' : 'highlights'}
                  </span>
                </div>
              </div>
              
              {/* Highlights for this section */}
              <div className="space-y-3">
                {group.highlights.map((highlight, index) => (
                  <Card 
                    key={highlight.id} 
                    className="hover:shadow-md transition-all duration-200 group focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                    role="article"
                    aria-labelledby={`highlight-${highlight.id}-text`}
                    aria-describedby={`highlight-${highlight.id}-details`}
                  >
                    <CardContent className="p-5">
                      {/* Highlight header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 mt-1" aria-hidden="true">
                          <div 
                            className={cn('w-4 h-4 rounded-full', getHighlightDotClass(highlight.color))}
                            title={`${highlight.color} highlight`}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div 
                            id={`highlight-${highlight.id}-details`}
                            className="flex items-center gap-2 text-xs text-gray-500 mb-3"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>Created {formatDate(highlight.createdAt)}</span>
                            <span className="text-gray-300" aria-hidden="true">•</span>
                            <span className="capitalize">{highlight.color} highlight</span>
                          </div>
                          
                          {/* Highlighted text */}
                          <div className={cn(
                            'p-4 rounded-lg mb-4 border-l-4 relative',
                            getHighlightColorClass(highlight.color)
                          )}>
                            <p 
                              id={`highlight-${highlight.id}-text`}
                              className="text-sm leading-relaxed font-medium"
                            >
                              "{highlight.text}"
                            </p>
                          </div>

                          {/* Note */}
                          {highlight.note ? (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg p-4 mb-4 border border-gray-200">
                              <div className="flex items-start gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span className="text-sm font-medium text-gray-700">Your note:</span>
                              </div>
                              <p className="text-sm text-gray-800 leading-relaxed pl-6">
                                {highlight.note}
                              </p>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 mb-4 italic flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" aria-hidden="true" />
                              <span>No note added yet</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div 
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-gray-100"
                        role="group"
                        aria-label={`Actions for highlight: ${highlight.text.substring(0, 50)}...`}
                      >
                        <div className="flex flex-1 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditNote(highlight)}
                            className="flex items-center justify-center gap-1.5 text-xs flex-1 sm:flex-initial min-h-[2.5rem] touch-manipulation"
                            aria-label={`${highlight.note ? 'Edit' : 'Add'} note for highlight: ${highlight.text.substring(0, 30)}...`}
                          >
                            <Edit className="h-3 w-3" aria-hidden="true" />
                            <span className="hidden sm:inline">{highlight.note ? 'Edit Note' : 'Add Note'}</span>
                            <span className="sm:hidden">{highlight.note ? 'Edit' : 'Add'}</span>
                          </Button>
                          
                          {onHighlightClick && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onHighlightClick(highlight.id)}
                              className="flex items-center justify-center gap-1.5 text-xs flex-1 sm:flex-initial min-h-[2.5rem] touch-manipulation"
                              aria-label={`Jump to highlighted text: ${highlight.text.substring(0, 30)}...`}
                            >
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              <span className="hidden sm:inline">Jump to Text</span>
                              <span className="sm:hidden">Jump</span>
                            </Button>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHighlight(highlight.id)}
                          className="flex items-center justify-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[2.5rem] touch-manipulation"
                          aria-label={`Delete highlight: ${highlight.text.substring(0, 30)}...`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditNoteDialog
        isOpen={showEditDialog}
        highlight={editingHighlight}
        onSave={handleSaveNote}
        onClose={() => {
          setShowEditDialog(false);
          setEditingHighlight(null);
        }}
      />

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Delete Highlight"
        message="Are you sure you want to delete this highlight and its note? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteHighlight}
        onCancel={() => {
          setShowConfirmDialog(false);
          setHighlightToDelete(null);
        }}
      />
    </div>
  );
}