'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, X as XIcon, Clock, BookOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import { updateResponse, getCaseStudiesByTeacher, getSessionsByTeacher, COLLECTIONS } from '@/lib/firebase/firestore';
import type { Response, CaseStudy, Session } from '@/types';
import { Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface StudentResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentDocId: string;
  studentName: string;
  teacherId: string;
}

interface ResponseWithContext extends Response {
  caseStudyTitle?: string;
  sectionTitle?: string;
  questionText?: string;
  questionType?: string;
  sessionCode?: string;
}

export default function StudentResponseModal({
  isOpen,
  onClose,
  studentId,
  studentDocId,
  studentName,
  teacherId
}: StudentResponseModalProps) {
  const [mounted, setMounted] = useState(false);
  const [responses, setResponses] = useState<ResponseWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !teacherId) return;

    const loadResponses = async () => {
      setLoading(true);
      try {
        // Get all case studies and sessions for context
        const [caseStudies, sessions] = await Promise.all([
          getCaseStudiesByTeacher(teacherId),
          getSessionsByTeacher(teacherId)
        ]);
        
        const caseStudyMap = new Map(caseStudies.map(cs => [cs.id, cs]));
        const sessionMap = new Map(sessions.map(s => [s.id, s]));

        // Get all responses for this student - try both document ID and readable studentId
        // Use the same pattern as getAllStudentsWithStats
        const queries = [
          query(
            collection(db, COLLECTIONS.RESPONSES),
            where('studentId', '==', studentDocId)
          ),
          ...(studentId && studentId !== studentDocId ? [
            query(
              collection(db, COLLECTIONS.RESPONSES),
              where('studentId', '==', studentId)
            )
          ] : [])
        ];
        
        const responseSnapshots = await Promise.all(queries.map(q => getDocs(q)));
        const allResponses = new Map<string, Response>();
        
        // Combine responses from both queries and deduplicate
        responseSnapshots.forEach(responseSnapshot => {
          responseSnapshot.docs.forEach(doc => {
            allResponses.set(doc.id, {
              id: doc.id,
              ...doc.data()
            } as Response);
          });
        });
        
        // Convert to array and add context
        const responsesWithContext: ResponseWithContext[] = [];
        for (const response of allResponses.values()) {
          const session = sessionMap.get(response.sessionId);
          const caseStudy = caseStudyMap.get(response.caseStudyId);
          const section = caseStudy?.sections?.find(s => s.id === response.sectionId);
          const question = section?.questions?.find(q => q.id === response.questionId);
          
          responsesWithContext.push({
            ...response,
            caseStudyTitle: caseStudy?.title || 'Unknown Case Study',
            sectionTitle: section?.title || 'Unknown Section', 
            questionText: question?.text || 'Unknown Question',
            questionType: question?.type || 'unknown',
            sessionCode: session?.sessionCode || 'Unknown Session'
          });
        }
        
        // Sort by submission date (newest first)
        responsesWithContext.sort((a, b) => {
          const aTime = a.submittedAt?.toDate?.() || new Date(0);
          const bTime = b.submittedAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });

        setResponses(responsesWithContext);
      } catch (error) {
        console.error('Error loading student responses:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResponses();
  }, [isOpen, studentId, studentDocId, teacherId]);

  const handleApprove = async (responseId: string, maxPoints: number) => {
    setProcessing(responseId);
    try {
      await updateResponse(responseId, {
        points: maxPoints,
        gradedAt: Timestamp.now(),
        gradedBy: teacherId
      });

      // Update local state
      setResponses(prev => prev.map(r => 
        r.id === responseId 
          ? { ...r, points: maxPoints, gradedAt: Timestamp.now(), gradedBy: teacherId }
          : r
      ));
    } catch (error) {
      console.error('Error approving response:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleDisapprove = async (responseId: string) => {
    setProcessing(responseId);
    try {
      await updateResponse(responseId, {
        points: 0,
        gradedAt: Timestamp.now(),
        gradedBy: teacherId
      });

      // Update local state
      setResponses(prev => prev.map(r => 
        r.id === responseId 
          ? { ...r, points: 0, gradedAt: Timestamp.now(), gradedBy: teacherId }
          : r
      ));
    } catch (error) {
      console.error('Error disapproving response:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (response: ResponseWithContext) => {
    const isOpenEnded = response.questionType === 'text' || response.questionType === 'essay';
    
    if (response.points === undefined) {
      if (isOpenEnded) {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Waiting for Approval
          </span>
        );
      } else {
        // Multiple choice question that hasn't been auto-graded yet (shouldn't happen normally)
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      }
    } else if (response.points === response.maxPoints) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          {isOpenEnded ? 'Approved' : 'Correct'}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XIcon className="w-3 h-3 mr-1" />
          {isOpenEnded ? 'Not Approved' : 'Incorrect'}
        </span>
      );
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 backdrop-blur-sm bg-black/50 transition-all"
        onClick={handleBackdropClick}
      />
      
      <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {studentName}&apos;s Responses
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              View and grade student responses
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading responses...</p>
            </div>
          ) : responses.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No responses found for this student.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {responses.map((response) => (
                <div key={response.id} className="border border-gray-200 rounded-lg p-4">
                  {/* Response Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900">
                          {response.caseStudyTitle} → {response.sectionTitle}
                        </h3>
                        {getStatusBadge(response)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Session: {response.sessionCode} • {response.submittedAt.toDate().toLocaleString()}
                      </p>
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        {response.questionText}
                      </p>
                    </div>
                  </div>

                  {/* Student Response */}
                  <div className="bg-gray-50 rounded p-3 mb-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{response.response}</p>
                  </div>

                  {/* Grading Actions for Open-ended Questions */}
                  {(response.questionType === 'text' || response.questionType === 'essay') && response.points === undefined && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600 mr-2">Grade this response:</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleApprove(response.id, response.maxPoints)}
                        loading={processing === response.id}
                        disabled={!!processing}
                        className="flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Approve ({response.maxPoints} pts)
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDisapprove(response.id)}
                        loading={processing === response.id}
                        disabled={!!processing}
                        className="flex items-center gap-1"
                      >
                        <XIcon className="w-4 h-4" />
                        Disapprove (0 pts)
                      </Button>
                    </div>
                  )}

                  {/* Already Graded Info */}
                  {response.points !== undefined && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Grade: {response.points}/{response.maxPoints} points
                        {response.gradedAt && (
                          <span className="ml-2">
                            • Graded on {(response.gradedAt as Timestamp).toDate().toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}