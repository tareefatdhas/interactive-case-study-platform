// Imports the Google GenAI client library for AI functionality.
import { GoogleGenAI } from "@google/genai";

// Imports interfaces for assessment requests and results from the existing assessment module.
import {
  AssessmentRequest,
  AssessmentResult,
  MilestoneDefinitions,
  DEFAULT_MILESTONES,
} from "./assessment";

// Throws an error if the Gemini API key is not found in the environment variables.
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in the environment variables");
}

// Initializes the Google GenAI client with the API key.
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Generates content using the Gemini 2.5 Flash model.
 *
 * @param {string} prompt - The text prompt to send to the model.
 * @returns {Promise<string>} - A promise that resolves to the generated text.
 */
export async function generateContent(prompt: string): Promise<string> {
  const contents = [
    {
      role: 'user' as const,
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
  });

  return response.text || '';
}

/**
 * Assesses a student's response using the Gemini Pro model, providing a score, feedback, and milestone analysis.
 *
 * @param {AssessmentRequest} request - The student's response and assessment context.
 * @param {MilestoneDefinitions} milestones - The milestones to assess against.
 * @returns {Promise<AssessmentResult>} - A promise that resolves to the detailed assessment result.
 */
export async function assessWithGemini(
  request: AssessmentRequest,
  milestones: MilestoneDefinitions = DEFAULT_MILESTONES
): Promise<AssessmentResult> {
  // Constructs a detailed prompt for the Gemini model to perform the assessment.
  const prompt = `
    Please act as an expert educator and assess the following student response based on the provided context and milestones.

    **Context:** ${request.context}
    **Question:** ${request.question}
    **Student Response:** ${request.studentResponse}

    **Assessment Milestones:**
    ${Object.entries(milestones)
      .map(
        ([key, milestone]) => `
      - **${milestone.name}**: ${milestone.description} (Criteria: ${milestone.criteria})
    `
      )
      .join("")}

    **Instructions:**
    1.  **Score:** Provide a score from 0 to ${request.maxPoints}.
    2.  **Feedback:** Offer constructive feedback for the student, highlighting strengths and areas for improvement.
    3.  **Milestone Analysis:** For each milestone, determine if it was achieved, provide evidence from the response, and a confidence score (0.0 to 1.0).

    **Output Format:**
    Return a single JSON object with the following structure:
    {
      "score": number,
      "feedback": "string",
      "milestones": {
        "milestone_key": {
          "achieved": boolean,
          "evidence": "string",
          "confidence": number
        },
        ...
      }
    }
  `;

  const contents = [
    {
      role: 'user' as const,
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    let responseText = response.text || '{}';
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*|\s*```/g, '');
    
    const jsonResponse = JSON.parse(responseText);
    return jsonResponse as AssessmentResult;
  } catch (error: any) {
    console.error("Error assessing with Gemini:", error);
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      cause: error.cause
    });
    
    // Returns a default error response if the API call fails.
    return {
      score: 0,
      feedback:
        "There was an error processing the assessment. Please try again.",
      milestones: {},
    };
  }
}

/**
 * Generates a personalized learning conclusion for a student based on their case study performance.
 *
 * @param {Object} params - The conclusion generation parameters.
 * @param {string} params.caseStudyTitle - The title of the case study.
 * @param {string} params.caseStudyDescription - The description/context of the case study.
 * @param {Array} params.responses - Array of student responses with questions and scores.
 * @param {Object} params.performance - Performance metrics (score, completion rate, etc.).
 * @param {string} params.studentName - The student's name for personalization.
 * @param {string} params.teacherGuidance - Optional guidance from the teacher for conclusions.
 * @returns {Promise<{keyInsights: string[], learningMilestones: Object, reflectionPrompts: string[]}>} - A promise that resolves to the conclusion data.
 */
export async function generateLearningConclusion(params: {
  caseStudyTitle: string;
  caseStudyDescription: string;
  responses: Array<{
    questionText: string;
    studentResponse: string;
    points: number;
    maxPoints: number;
    sectionTitle: string;
  }>;
  performance: {
    totalScore: number;
    maxScore: number;
    percentageScore: number;
    completionRate: number;
  };
  studentName: string;
  teacherGuidance?: string;
}): Promise<{
  keyInsights: string[];
  learningMilestones: {
    [key: string]: {
      achieved: boolean;
      progress: number;
      evidence: string;
      confidence: number;
    };
  };
  reflectionPrompts: string[];
}> {
  const prompt = `
    You are an expert educational assessment specialist. Generate a personalized learning conclusion for a student who has completed a case study.

    **Case Study:** ${params.caseStudyTitle}
    **Context:** ${params.caseStudyDescription}
    **Student:** ${params.studentName}

    **Performance Summary:**
    - Score: ${params.performance.totalScore}/${params.performance.maxScore} (${params.performance.percentageScore}%)
    - Completion Rate: ${params.performance.completionRate}%

    **Student Responses:**
    ${params.responses.map((r, i) => `
    ${i + 1}. **Section: ${r.sectionTitle}**
       Question: ${r.questionText}
       Student Response: ${r.studentResponse}
       Score: ${r.points}/${r.maxPoints}
    `).join('')}

    ${params.teacherGuidance ? `**Teacher Guidance for Conclusions:** ${params.teacherGuidance}` : ''}

    **Learning Milestones to Assess:**
    ${Object.entries(DEFAULT_MILESTONES)
      .map(
        ([key, milestone]) => `
      - **${key}** (${milestone.name}): ${milestone.description}
        Criteria: ${milestone.criteria}
    `
      )
      .join("")}

    **Instructions:**
    Analyze the student's responses and performance to create a personalized learning conclusion. Generate:

    1. **Key Insights** (3-4 insights): Specific, personalized observations about their learning journey, referencing actual content from their responses
    2. **Learning Milestones**: For each milestone, assess if achieved based on evidence from their responses
    3. **Reflection Prompts** (3 questions): Thoughtful questions that connect to their specific responses and the case study content

    **Output Format:**
    Return a single JSON object:
    {
      "keyInsights": [
        "Specific insight about their learning based on actual responses",
        "Another personalized observation with evidence",
        "Third insight connecting their work to broader concepts"
      ],
      "learningMilestones": {
        "critical_thinking": {
          "achieved": boolean,
          "progress": number (0.0 to 1.0),
          "evidence": "Specific evidence from their responses",
          "confidence": number (0.0 to 1.0)
        },
        "problem_solving": { ... },
        "evidence_based": { ... },
        "communication": { ... },
        "synthesis": { ... }
      },
      "reflectionPrompts": [
        "Question that builds on their specific responses",
        "Question about real-world application of their insights",
        "Question about areas for continued exploration"
      ]
    }

    **Requirements:**
    - Base insights on ACTUAL content from their responses, not generic statements
    - Reference specific sections or answers they provided
    - Make milestone assessments evidence-based from their work
    - Create reflection questions that connect to their specific learning journey
    - Be encouraging while providing constructive guidance
    - Use the student's name naturally in insights when appropriate
  `;

  const contents = [
    {
      role: 'user' as const,
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    let responseText = response.text || '{}';
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*|\s*```/g, '');
    
    const jsonResponse = JSON.parse(responseText);
    return jsonResponse;
  } catch (error: any) {
    console.error("Error generating learning conclusion with Gemini:", error);
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      cause: error.cause
    });
    
    // Return a fallback response if the API call fails
    return {
      keyInsights: [
        "You engaged thoughtfully with the case study material and demonstrated learning progress.",
        "Your responses showed effort and engagement with the key concepts presented.",
        "This learning experience has provided you with valuable insights to build upon."
      ],
      learningMilestones: Object.keys(DEFAULT_MILESTONES).reduce((acc, key) => {
        acc[key] = {
          achieved: params.performance.percentageScore >= 70,
          progress: Math.min(1, params.performance.percentageScore / 100),
          evidence: "Assessment temporarily unavailable",
          confidence: 0.5
        };
        return acc;
      }, {} as any),
      reflectionPrompts: [
        "What was the most important concept you learned from this case study?",
        "How might you apply these insights in real-world situations?",
        "What questions do you still have about this topic?"
      ]
    };
  }
}

/**
 * Summarizes multiple student responses for a text question using Gemini Flash 2.5.
 *
 * @param {Object} params - The summarization parameters.
 * @param {string} params.questionText - The original question text.
 * @param {Array<{studentName: string, response: string}>} params.responses - Array of student responses.
 * @param {string} params.context - Context about the case study or lesson.
 * @returns {Promise<{summary: string, keyThemes: string[], insights: string[]}>} - A promise that resolves to the summarization result.
 */
export async function summarizeResponses(params: {
  questionText: string;
  responses: Array<{ studentName: string; response: string }>;
  context?: string;
}): Promise<{
  summary: string;
  keyThemes: string[];
  insights: string[];
}> {

  const prompt = `
    Please analyze student responses to create a VERY CONCISE classroom overview for live teaching. The teacher needs to quickly scan this while teaching.

    **Question:** ${params.questionText}
    ${params.context ? `**Context:** ${params.context}` : ''}

    **Student Responses (${params.responses.length} total):**
    ${params.responses.map((r, i) => `
    ${i + 1}. **${r.studentName}:** ${r.response}
    `).join('')}

    **Instructions:**
    Create a BRIEF analysis in this JSON format:

    {
      "summary": "One clear sentence about the main trend or pattern in responses",
      "keyThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4"],
      "insights": [
        "Quick observation about the class thinking",
        "Brief note about interesting patterns or connections"
      ]
    }

    **Critical Requirements:**
    - Summary: MAXIMUM 15-20 words, one sentence only
    - Key Themes: Exactly 4 themes, 2-3 words each maximum
    - Insights: Exactly 3 insights, 8-12 words each maximum
    - Use simple, clear language a teacher can quickly scan
    - Focus on the most obvious patterns only
    - Be concise enough to read in 10 seconds while teaching
  `;

  const contents = [
    {
      role: 'user' as const,
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    let responseText = response.text || '{}';
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*|\s*```/g, '');
    
    const jsonResponse = JSON.parse(responseText);
    return jsonResponse;
  } catch (error: any) {
    console.error("Error summarizing responses with Gemini:", error);
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      cause: error.cause
    });
    
    // Return a fallback response if the API call fails
    return {
      summary: "Unable to generate summary at this time. Please try again later.",
      keyThemes: ["Analysis unavailable"],
      insights: ["AI summarization temporarily unavailable"]
    };
  }
}
