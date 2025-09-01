'use client';

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { CaseStudy } from '@/types';

interface CaseStudyPDFExportProps {
  caseStudy: CaseStudy;
  className?: string;
}

const CaseStudyPDFExport: React.FC<CaseStudyPDFExportProps> = ({ caseStudy, className = '' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getQuestionCount = () => {
    return caseStudy.sections?.reduce((total, section) => total + (section.questions?.length || 0), 0) || 0;
  };

  const getEstimatedTime = () => {
    const questionCount = getQuestionCount();
    const sectionCount = caseStudy.sections?.length || 0;
    // Estimate 2 minutes per section reading + 1.5 minutes per question
    return Math.max(5, Math.round((sectionCount * 2) + (questionCount * 1.5)));
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    
    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin;

      // Helper function to add text with line wrapping
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12, style: 'normal' | 'bold' = 'normal') => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', style);
        
        const lines = pdf.splitTextToSize(text, maxWidth);
        const lineHeight = fontSize * 0.5;
        
        for (let i = 0; i < lines.length; i++) {
          if (y + (i * lineHeight) > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(lines[i], x, y + (i * lineHeight));
        }
        
        return y + (lines.length * lineHeight);
      };

      // Helper function to strip HTML and format text
      const stripHtml = (html: string) => {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
      };

      // Helper function to check if we need a new page
      const checkPageBreak = (spaceNeeded: number) => {
        if (currentY + spaceNeeded > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
      };

      // Title and header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(caseStudy.title.toUpperCase(), contentWidth);
      for (let i = 0; i < titleLines.length; i++) {
        pdf.text(titleLines[i], pageWidth / 2, currentY, { align: 'center' });
        currentY += 12;
      }

      currentY += 10;

      // Case Study info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const infoText = `Case Study • Created: ${formatDate(caseStudy.createdAt)}`;
      pdf.text(infoText, pageWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      const statsText = `${caseStudy.sections?.length || 0} Sections • ${getQuestionCount()} Questions • Estimated Time: ${getEstimatedTime()} minutes • Total Points: ${caseStudy.totalPoints}`;
      pdf.text(statsText, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;

      // Horizontal line
      pdf.setDrawColor(0);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 15;

      // Description
      if (caseStudy.description) {
        checkPageBreak(30);
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('OVERVIEW', margin, currentY);
        currentY += 10;

        const descText = stripHtml(caseStudy.description);
        currentY = addWrappedText(descText, margin, currentY, contentWidth, 11) + 15;
      }

      // Sections
      caseStudy.sections?.forEach((section, sectionIndex) => {
        checkPageBreak(50);

        // Section header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, currentY - 5, contentWidth, 15, 'F');
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const sectionTitle = `SECTION ${sectionIndex + 1}: ${section.title.toUpperCase()}`;
        pdf.text(sectionTitle, margin + 5, currentY + 5);
        
        // Section type badge
        const sectionType = section.type === 'reading' ? 'READING' : 
                           section.type === 'discussion' ? 'DISCUSSION' : 
                           section.type === 'activity' ? 'ACTIVITY' : section.type?.toUpperCase() || '';
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        const typeWidth = pdf.getTextWidth(sectionType) + 4;
        pdf.setFillColor(227, 242, 253);
        pdf.rect(pageWidth - margin - typeWidth - 5, currentY - 2, typeWidth, 8, 'F');
        pdf.text(sectionType, pageWidth - margin - typeWidth - 3, currentY + 3);
        
        currentY += 20;

        // Section content
        let content = '';
        if (section.type === 'reading' && section.content) {
          content = stripHtml(section.content);
        } else if (section.type === 'discussion' && section.discussionPrompt) {
          content = `Discussion Prompt: ${stripHtml(section.discussionPrompt)}`;
        } else if (section.type === 'activity' && section.activityInstructions) {
          content = `Activity Instructions: ${stripHtml(section.activityInstructions)}`;
        }

        if (content) {
          currentY = addWrappedText(content, margin + 5, currentY, contentWidth - 10, 10) + 10;
        }

        // Questions for reading sections
        if (section.type === 'reading' && section.questions && section.questions.length > 0) {
          checkPageBreak(30);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Questions for Section ${sectionIndex + 1}`, margin, currentY);
          currentY += 10;

          section.questions.forEach((question, questionIndex) => {
            checkPageBreak(40);
            
            // Question header
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, currentY - 2, contentWidth, 8, 'F');
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Question ${questionIndex + 1} (${question.points} points)`, margin + 3, currentY + 3);
            currentY += 12;

            // Question text
            currentY = addWrappedText(question.text, margin + 5, currentY, contentWidth - 10, 10) + 5;

            // Answer options for multiple choice
            if (question.type === 'multiple-choice' && question.options) {
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'normal');
              pdf.text('Answer Options:', margin + 5, currentY);
              currentY += 6;

              question.options.forEach((option, optionIndex) => {
                const optionLetter = String.fromCharCode(65 + optionIndex);
                const optionText = `${optionLetter}. ${option}`;
                const correctMark = question.correctAnswer === optionIndex ? ' ✓ Correct' : '';
                
                currentY = addWrappedText(optionText + correctMark, margin + 10, currentY, contentWidth - 20, 9) + 2;
              });

              if (question.correctAnswerExplanation) {
                currentY += 3;
                pdf.setFont('helvetica', 'italic');
                pdf.text('Explanation:', margin + 5, currentY);
                currentY += 5;
                currentY = addWrappedText(question.correctAnswerExplanation, margin + 10, currentY, contentWidth - 20, 9);
              }
            }

            // Answer space for text/essay questions
            if (question.type === 'text' || question.type === 'essay') {
              pdf.setDrawColor(200);
              pdf.setLineDashPattern([2, 2], 0);
              for (let i = 0; i < 3; i++) {
                pdf.line(margin + 5, currentY + (i * 8), pageWidth - margin - 5, currentY + (i * 8));
              }
              pdf.setLineDashPattern([], 0);
              currentY += 25;
            }

            currentY += 10;
          });
        }

        currentY += 5;
      });

      // Footer
      checkPageBreak(20);
      currentY += 10;
      pdf.setDrawColor(200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('This case study was generated for educational purposes.', pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      pdf.text(`Total Points: ${caseStudy.totalPoints} • Estimated Completion Time: ${getEstimatedTime()} minutes`, pageWidth / 2, currentY, { align: 'center' });

      // Generate filename and save
      const filename = `${caseStudy.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_case_study.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleExportPDF}
        disabled={isExporting}
        variant="outline"
        className={className}
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 mr-2 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
            Generating PDF...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Export as PDF
          </>
        )}
      </Button>
    </>
  );
};

export default CaseStudyPDFExport;
