import { NextRequest, NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const { prompt, learningObjectives, teacherId } = await request.json();

    if (!prompt || !learningObjectives || !teacherId) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, learningObjectives, teacherId' },
        { status: 400 }
      );
    }

    const generationPrompt = `
You are an expert case study writer specializing in Harvard Business School-style case studies. Create a comprehensive, engaging case study based on the following requirements:

**Teacher's Prompt:** ${prompt}

**Learning Objectives:** ${learningObjectives}

**Instructions:**
Create a complete case study with the following structure:

1. **Title**: Compelling, specific title that captures the essence of the case
2. **Description**: Student-facing introduction (2-3 sentences) that sets up the scenario and context WITHOUT revealing learning objectives or outcomes
3. **Sections**: Create 5-7 sections with the following types:
   - **Reading sections** (3-4): Main narrative content with engaging storytelling
   - **Discussion sections** (1-2): Thought-provoking discussion prompts
   - **Activity sections** (0-1): Hands-on activities or exercises
   - **Conclusion section** (1): Final reading section that synthesizes key learning points

**Content Guidelines:**
- Write in HBS case study style: narrative-driven, engaging, realistic scenarios
- Include specific details, data, quotes, and context to make it feel authentic
- Each reading section should be 300-500 words
- Create a compelling protagonist/company/situation that students can relate to
- Include relevant business/academic concepts naturally within the narrative
- Write ALL content from the STUDENT perspective - they are reading a business case, not a lesson plan
- MUST end with a dedicated conclusion section titled "Conclusion" or similar that synthesizes the case narrative and key decision points (150-200 words)

**Questions Guidelines:**
- Include 1-2 questions per reading section
- Mix of multiple choice (with 4 options) and open-ended questions
- Questions should require critical thinking, not just recall
- Multiple choice questions should have one clearly correct answer with explanations
- Open-ended questions should encourage analysis, evaluation, or application
- Point values: Multiple choice = 10 points, Short answer = 15 points, Essay = 20 points

**Section Length Guidelines:**
- Reading sections: 300-500 words each
- Discussion prompts: 100-150 words with clear, thought-provoking questions
- Activity instructions: 150-250 words with specific, actionable steps
- Conclusion section: 150-200 words as a "reading" type section that wraps up the case narrative and presents the final decision point or outcome

**Output Format:**
Return a JSON object with this exact structure:
{
  "title": "Compelling Case Study Title",
  "description": "Student-facing introduction that sets up the business scenario and context without revealing learning objectives",
  "conclusionGuidance": "Brief guidance for AI-generated learning conclusions focusing on key themes and concepts",
  "sections": [
    {
      "title": "Section Title",
      "type": "reading",
      "content": "Rich HTML content with proper formatting using <p>, <strong>, <em>, <ul>, <li> tags",
      "questions": [
        {
          "text": "Thoughtful question requiring critical thinking",
          "type": "multiple-choice",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "correctAnswerExplanation": "Explanation of why this is correct",
          "points": 10
        },
        {
          "text": "Open-ended analysis question",
          "type": "text",
          "points": 15
        }
      ]
    },
    {
      "title": "Discussion Topic Title",
      "type": "discussion", 
      "discussionPrompt": "HTML formatted discussion prompt with clear questions and context"
    },
    {
      "title": "Activity Title",
      "type": "activity",
      "activityInstructions": "HTML formatted step-by-step activity instructions"
    }
  ]
}

**Critical Requirements:**
- Ensure all content is educationally sound and appropriate
- Make the narrative engaging and realistic
- Include specific details that make the case feel authentic
- Questions must require higher-order thinking skills
- Use proper HTML formatting in content fields
- Create a logical flow from section to section
- MUST end with a dedicated conclusion section (type: "reading") that wraps up the business narrative
- The conclusion should NOT have questions - it should be purely narrative

**CRITICAL: Student-Facing Content Guidelines:**
- Write the DESCRIPTION as if introducing students to a business case: "In this case, you will examine..." or "This case follows..." 
- Do NOT mention learning objectives, educational goals, or what students "will learn"
- Write all READING sections as pure business narrative - tell the story of the company/situation
- Do NOT include phrases like "students will analyze" or "this demonstrates" - write as if documenting real business events
- The CONCLUSION should wrap up the business story and present the final decision point or outcome
- Keep the academic analysis for the QUESTIONS only - the narrative should read like a business story

Generate a complete, ready-to-use case study that teachers can immediately deploy in their classrooms.
`;

    console.log('🤖 Generating case study with AI...');
    const aiResponse = await generateContent(generationPrompt);
    
    console.log('✅ AI generation completed');
    
    // Parse the AI response with improved error handling
    let caseStudyData;
    try {
      // Remove any markdown code blocks and extra whitespace
      let cleanedResponse = aiResponse.replace(/```json\s*|\s*```/g, '').trim();
      
      // Try to find JSON content if it's wrapped in other text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('🔍 Attempting to parse cleaned response (first 200 chars):', cleanedResponse.substring(0, 200));
      caseStudyData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw AI response (first 500 chars):', aiResponse.substring(0, 500));
      console.error('Cleaned response (first 500 chars):', aiResponse.replace(/```json\s*|\s*```/g, '').trim().substring(0, 500));
      return NextResponse.json(
        { 
          error: 'AI generated content in an invalid format. This sometimes happens with complex requests. Please try again with a simpler prompt or different wording.',
          details: 'JSON parsing failed'
        },
        { status: 500 }
      );
    }

    // Validate the structure with detailed error messages
    if (!caseStudyData.title) {
      console.error('❌ Missing title in AI response');
      return NextResponse.json(
        { error: 'AI failed to generate a proper title. Please try again with a clearer prompt.' },
        { status: 500 }
      );
    }
    
    if (!caseStudyData.sections || !Array.isArray(caseStudyData.sections)) {
      console.error('❌ Missing or invalid sections in AI response:', caseStudyData);
      return NextResponse.json(
        { error: 'AI failed to generate proper case study sections. Please try again.' },
        { status: 500 }
      );
    }
    
    if (caseStudyData.sections.length === 0) {
      console.error('❌ No sections generated');
      return NextResponse.json(
        { error: 'AI generated an empty case study. Please try again with more detailed requirements.' },
        { status: 500 }
      );
    }

    // Add required fields and generate IDs for sections and questions
    const processedData = {
      ...caseStudyData,
      courseId: 'default',
      teacherId,
      archived: false,
      sections: caseStudyData.sections.map((section: any, index: number) => ({
        id: `section_${Date.now()}_${index}`,
        ...section,
        order: index,
        content: section.content || '',
        questions: (section.questions || []).map((question: any, qIndex: number) => ({
          id: `question_${Date.now()}_${index}_${qIndex}`,
          ...question,
          points: question.points || (question.type === 'multiple-choice' ? 10 : question.type === 'essay' ? 20 : 15)
        }))
      }))
    };

    // Calculate total points
    const totalPoints = processedData.sections.reduce((total: number, section: any) => 
      total + (section.questions || []).reduce((sectionTotal: number, question: any) => 
        sectionTotal + (question.points || 0), 0
      ), 0
    );

    processedData.totalPoints = totalPoints;

    console.log('✅ Case study generated successfully:', {
      title: processedData.title,
      sections: processedData.sections.length,
      totalPoints: processedData.totalPoints
    });

    return NextResponse.json({
      success: true,
      caseStudy: processedData
    });

  } catch (error: any) {
    console.error('❌ Error generating case study:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate case study. Please try again.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
