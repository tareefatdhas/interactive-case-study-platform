import { NextRequest, NextResponse } from 'next/server';
import { generateLearningConclusion } from '@/lib/ai/gemini';
import { DEFAULT_MILESTONES } from '@/lib/ai/assessment';
import { firebaseRequestError, requireFirebaseUser } from '@/lib/firebase/server-auth';

export async function POST(request: NextRequest) {
  try {
    await requireFirebaseUser(request, { allowAnonymous: true, requestsPerMinute: 4 });
    const body = await request.json();
    const { 
      caseStudyTitle, 
      caseStudyDescription, 
      responses, 
      performance, 
      studentName, 
      teacherGuidance 
    } = body;

    // Validate required fields
    if (!caseStudyTitle || !studentName || !responses || !performance) {
      return NextResponse.json(
        { error: 'Missing required fields: caseStudyTitle, studentName, responses, performance' },
        { status: 400 }
      );
    }

    try {
      // Generate AI-powered conclusion
      const result = await generateLearningConclusion({
        caseStudyTitle,
        caseStudyDescription: caseStudyDescription || '',
        responses,
        performance,
        studentName,
        teacherGuidance
      });

      return NextResponse.json({
        success: true,
        result
      });

    } catch (aiError: any) {
      console.error('❌ AI generation failed:', aiError.message);
      
      // Provide fallback conclusion
      const fallbackResult = {
        keyInsights: [
          `${studentName} completed the case study. This summary is based on the submitted responses.`,
          "The response record is available below for review.",
          "A more specific summary could not be generated at this time."
        ],
        learningMilestones: Object.keys(DEFAULT_MILESTONES).reduce((acc, key) => {
          acc[key] = {
            name: DEFAULT_MILESTONES[key].name,
            achieved: performance.percentageScore >= 70,
            progress: Math.min(1, performance.percentageScore / 100),
            evidence: "Estimate based on the overall score only.",
            confidence: 0.4
          };
          return acc;
        }, {} as any),
        reflectionPrompts: [
          "What was the most important concept you learned from this case study?",
          "How might you apply these insights in real-world situations?",
          "What questions do you still have about this topic?"
        ]
      };

      return NextResponse.json({
        success: true,
        result: fallbackResult,
        fallback: true,
      });
    }

  } catch (error: any) {
    const authError = firebaseRequestError(error);
    if (authError) return NextResponse.json({ success: false, error: authError.error }, { status: authError.status });
    console.error('💥 Conclusion API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'The reflection summary is not ready yet. Your responses are safe, so try again in a moment.'
    }, { status: 500 });
  }
}
