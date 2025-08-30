import { NextResponse } from "next/server";
import { summarizeResponses } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
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
        { error: "No valid responses to summarize" },
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
    console.error("API Error:", error);
    
    // Provide more detailed error information
    let errorMessage = "Failed to summarize responses";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
