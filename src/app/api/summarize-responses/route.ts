import { NextResponse } from "next/server";
import { summarizeResponses } from "@/lib/ai/gemini";
import { firebaseRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

export async function POST(request: Request) {
  try {
    await requireFirebaseUser(request, { requestsPerMinute: 8 });
    const body = await request.json();
    const { questionText, responses, context } = body;

    // Validate required fields
    if (!questionText || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Missing required fields: questionText and responses array" },
        { status: 400 }
      );
    }

    // Validate that responses have the required structure
    for (const response of responses) {
      if (!response.studentName || !response.response) {
        return NextResponse.json(
          { error: "Each response must have studentName and response fields" },
          { status: 400 }
        );
      }
    }

    // Filter out empty responses
    const validResponses = responses.filter(r => 
      r.response && r.response.trim().length > 0
    );

    if (validResponses.length === 0) {
      return NextResponse.json(
        { error: 'There are no written responses to summarize yet.' },
        { status: 400 }
      );
    }

    // Call the Gemini summarization function
    const result = await summarizeResponses({
      questionText,
      responses: validResponses,
      context
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    const authError = firebaseRequestError(error);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });
    console.error("API Error:", error);
    
    return NextResponse.json(
      { error: 'The response summary is not ready yet. Student responses are safe, so try again in a moment.' },
      { status: 500 }
    );
  }
}
