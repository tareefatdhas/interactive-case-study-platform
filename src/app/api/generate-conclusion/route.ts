import { NextRequest, NextResponse } from 'next/server';
import { generateLearningConclusion } from '@/lib/ai/gemini';
import { DEFAULT_MILESTONES } from '@/lib/ai/assessment';

export async function POST(request: NextRequest) {
  try {
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

    console.log('🤖 Generating AI conclusion for:', studentName);
    console.log('📊 Performance:', `${performance.totalScore}/${performance.maxScore} (${performance.percentageScore}%)`);

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

      console.log('✅ AI conclusion generated successfully');
      
      return NextResponse.json({
        success: true,
        result
      });

    } catch (aiError: any) {
      console.error('❌ AI generation failed:', aiError.message);
      
      // Provide fallback conclusion
      const fallbackResult = {
        keyInsights: [
          `${studentName} engaged thoughtfully with the case study material and demonstrated learning progress.`,
          "Your responses showed effort and engagement with the key concepts presented.",
          "This learning experience has provided you with valuable insights to build upon."
        ],
        learningMilestones: Object.keys(DEFAULT_MILESTONES).reduce((acc, key) => {
          acc[key] = {
            name: DEFAULT_MILESTONES[key].name,
            achieved: performance.percentageScore >= 70,
            progress: Math.min(1, performance.percentageScore / 100),
            evidence: "Assessment based on overall performance",
            confidence: 0.7
          };
          return acc;
        }, {} as any),
        reflectionPrompts: [
          "What was the most important concept you learned from this case study?",
          "How might you apply these insights in real-world situations?",
          "What questions do you still have about this topic?"
        ]
      };

      console.log('🔄 Using fallback conclusion');
      
      return NextResponse.json({
        success: true,
        result: fallbackResult,
        fallback: true,
        originalError: aiError.message
      });
    }

  } catch (error: any) {
    console.error('💥 Conclusion API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
