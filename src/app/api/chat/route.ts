import { NextRequest, NextResponse } from 'next/server';
import { assessStudentResponse, calculateSessionProgress, DEFAULT_MILESTONES } from '@/lib/ai/assessment';
import { getResponsesByStudent, updateResponse } from '@/lib/firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, studentId, sessionId, questionId, context } = body;

    if (!message || !studentId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, studentId, sessionId' },
        { status: 400 }
      );
    }

    // Get student's previous responses for context
    const studentResponses = await getResponsesByStudent(studentId, sessionId);
    
    // Assess the current response using AI
    const assessment = await assessStudentResponse({
      studentResponse: message,
      question: context?.question || "General response",
      context: context?.caseStudyContent || "",
      maxPoints: context?.maxPoints || 10
    });

    // Calculate overall session progress
    const sessionProgress = calculateSessionProgress(studentResponses, DEFAULT_MILESTONES);

    // Update the response with assessment data if questionId is provided
    if (questionId) {
      try {
        const responseToUpdate = studentResponses.find(r => r.questionId === questionId);
        if (responseToUpdate) {
          await updateResponse(responseToUpdate.id, {
            points: assessment.score,
            assessment: assessment,
            gradedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error updating response with assessment:', error);
      }
    }

    // Return response in the specified format
    const response = {
      message: assessment.feedback,
      timestamp: new Date().toISOString(),
      status: {
        progress: sessionProgress.progress,
        progressChanged: sessionProgress.progressChanged,
        milestones: sessionProgress.milestones
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return error response in the specified format
    return NextResponse.json(
      {
        message: "I'm having trouble processing your response right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        status: {
          progress: 0,
          progressChanged: false,
          milestones: Object.fromEntries(
            Object.entries(DEFAULT_MILESTONES).map(([key, milestone]) => [
              key, 
              { 
                name: milestone.name,
                achieved: false,
                progress: 0,
                evidence: "",
                confidence: 0
              }
            ])
          )
        }
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Chat API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      POST: 'Submit student response for AI assessment',
      GET: 'Health check'
    }
  });
}
