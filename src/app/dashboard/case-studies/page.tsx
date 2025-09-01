'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher, duplicateCaseStudy, archiveCaseStudy } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import type { CaseStudy } from '@/types';
import { BookOpen, Plus, Play, Edit, Calendar, Users, Clock, Award, FileText, HelpCircle, Copy, Archive, MoreVertical, Sparkles, Download } from 'lucide-react';
import CaseStudyPDFExport from '@/components/teacher/CaseStudyPDFExport';

export default function CaseStudiesPage() {
  const { user } = useAuth();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [caseStudyToArchive, setCaseStudyToArchive] = useState<CaseStudy | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    const loadCaseStudies = async () => {
      if (user) {
        try {
          const studies = await getCaseStudiesByTeacher(user.uid);
          setCaseStudies(studies);
        } catch (error) {
          console.error('Error loading case studies:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadCaseStudies();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [dropdownOpen]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getQuestionCount = (caseStudy: CaseStudy) => {
    return caseStudy.sections?.reduce((total, section) => total + (section.questions?.length || 0), 0) || 0;
  };

  const getEstimatedTime = (caseStudy: CaseStudy) => {
    const questionCount = getQuestionCount(caseStudy);
    const sectionCount = caseStudy.sections?.length || 0;
    // Estimate 2 minutes per section reading + 1.5 minutes per question
    return Math.max(5, Math.round((sectionCount * 2) + (questionCount * 1.5)));
  };

  const getQuestionTypes = (caseStudy: CaseStudy) => {
    const types = new Set<string>();
    caseStudy.sections?.forEach(section => {
      section.questions?.forEach(question => {
        types.add(question.type);
      });
    });
    return Array.from(types);
  };

  const handleDuplicate = async (caseStudy: CaseStudy) => {
    if (!user) return;
    
    setActionLoading(`duplicate-${caseStudy.id}`);
    try {
      const newId = await duplicateCaseStudy(caseStudy.id);
      // Reload case studies to show the new duplicate
      const studies = await getCaseStudiesByTeacher(user.uid);
      setCaseStudies(studies);
    } catch (error) {
      console.error('Error duplicating case study:', error);
      // You could add toast notification here
    } finally {
      setActionLoading(null);
      setDropdownOpen(null);
    }
  };

  const handleArchiveClick = (caseStudy: CaseStudy) => {
    console.log('📦 Archive clicked for case study:', caseStudy.title);
    setCaseStudyToArchive(caseStudy);
    setArchiveDialogOpen(true);
    setDropdownOpen(null);
  };

  const handleArchiveConfirm = async () => {
    console.log('📦 Archive confirmed for case study:', caseStudyToArchive?.title);
    if (!caseStudyToArchive || !user) {
      console.log('❌ Missing caseStudyToArchive or user:', { caseStudyToArchive: !!caseStudyToArchive, user: !!user });
      return;
    }

    setActionLoading(`archive-${caseStudyToArchive.id}`);
    console.log('⏳ Starting archive process...');
    try {
      await archiveCaseStudy(caseStudyToArchive.id);
      console.log('✅ Case study archived successfully');
      // Remove from local state (since we filter out archived ones)
      setCaseStudies(prev => prev.filter(cs => cs.id !== caseStudyToArchive.id));
      console.log('✅ UI updated - case study removed from list');
    } catch (error) {
      console.error('❌ Error archiving case study:', error);
      // You could add toast notification here
    } finally {
      setActionLoading(null);
      setArchiveDialogOpen(false);
      setCaseStudyToArchive(null);
      console.log('✅ Archive process completed - dialog closed');
    }
  };

  const handleArchiveCancel = () => {
    console.log('❌ Archive cancelled');
    setArchiveDialogOpen(false);
    setCaseStudyToArchive(null);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Case Studies</h1>
              <p className="text-gray-600 mt-1">
                Manage your interactive case studies and create new ones.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard/case-studies/generate">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate with AI
                </Button>
              </Link>
              <Link href="/dashboard/case-studies/new">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Manually
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : caseStudies.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No case studies yet</h3>
                <p className="text-gray-600 mb-6">
                  Get started by creating your first interactive case study.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link href="/dashboard/case-studies/generate">
                    <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate with AI
                    </Button>
                  </Link>
                  <Link href="/dashboard/case-studies/new">
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Manually
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {caseStudies.map((caseStudy) => {
                const questionCount = getQuestionCount(caseStudy);
                const estimatedTime = getEstimatedTime(caseStudy);
                const questionTypes = getQuestionTypes(caseStudy);
                
                return (
                  <Card key={caseStudy.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border border-gray-200">
                    {/* Header with Title and Actions */}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold text-gray-900 leading-tight mb-2 line-clamp-2">
                            {caseStudy.title}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(caseStudy.createdAt)}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              ~{estimatedTime} min
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions Dropdown */}
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownOpen(dropdownOpen === caseStudy.id ? null : caseStudy.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {dropdownOpen === caseStudy.id && (
                            <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                              <div className="py-1">
                                <Link 
                                  href={`/dashboard/case-studies/${caseStudy.id}/edit`}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                  onClick={() => setDropdownOpen(null)}
                                >
                                  <Edit className="w-4 h-4 mr-3" />
                                  Edit
                                </Link>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(caseStudy);
                                  }}
                                  disabled={actionLoading === `duplicate-${caseStudy.id}`}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                                >
                                  <Copy className="w-4 h-4 mr-3" />
                                  {actionLoading === `duplicate-${caseStudy.id}` ? 'Duplicating...' : 'Duplicate'}
                                </button>
                                <div className="px-4 py-2">
                                  <CaseStudyPDFExport 
                                    caseStudy={caseStudy} 
                                    className="w-full justify-start text-left text-sm font-normal h-auto p-0 text-gray-700 hover:bg-transparent"
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveClick(caseStudy);
                                  }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <Archive className="w-4 h-4 mr-3" />
                                  Archive
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <CardDescription className="line-clamp-2 text-sm text-gray-600">
                        <div 
                          className="prose prose-sm max-w-none [&>p]:m-0 [&>strong]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1"
                          dangerouslySetInnerHTML={{ __html: caseStudy.description || 'No description provided.' }}
                        />
                      </CardDescription>
                    </CardHeader>

                    {/* Content with Statistics */}
                    <CardContent className="pt-0">
                      {/* Statistics Row */}
                      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {caseStudy.sections?.length || 0}
                          </div>
                          <div className="text-xs text-gray-500">Sections</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <HelpCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {questionCount}
                          </div>
                          <div className="text-xs text-gray-500">Questions</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Award className="w-4 h-4 text-yellow-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {caseStudy.totalPoints}
                          </div>
                          <div className="text-xs text-gray-500">Points</div>
                        </div>
                      </div>

                      {/* Question Types Tags */}
                      {questionTypes.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {questionTypes.map((type) => (
                              <span 
                                key={type}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {type === 'multiple-choice' ? 'Multiple Choice' : 
                                 type === 'text' ? 'Short Answer' : 
                                 type.charAt(0).toUpperCase() + type.slice(1)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <Link href={`/dashboard/sessions/new?caseStudy=${caseStudy.id}`} className="block">
                        <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white">
                          <Play className="w-4 h-4 mr-2" />
                          Start Session
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Archive Confirmation Dialog */}
        <Dialog 
          isOpen={archiveDialogOpen}
          onClose={handleArchiveCancel}
          onConfirm={handleArchiveConfirm}
          title="Archive Case Study"
          message={`Are you sure you want to archive "${caseStudyToArchive?.title}"? This will hide it from your case studies list but preserve all session data and references. You can restore it later if needed.`}
          confirmText={actionLoading ? 'Archiving...' : 'Archive'}
          cancelText="Cancel"
          variant="default"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
