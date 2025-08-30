# Gemini AI Integration Guide

This guide provides instructions on how to build and deploy Gemini AI-powered functions and features within the case study platform.

## 1. Setup and Configuration

### 1.1. API Key Management

To use the Gemini API, you need an API key from Google AI Studio.

1.  **Obtain an API Key**:
    *   Go to [Google AI Studio](https://aistudio.google.com/).
    *   Sign in with your Google account.
    *   Create a new project or use an existing one.
    *   Navigate to the **API Keys** section and generate a new API key.

2.  **Store the API Key**:
    *   Create a `.env.local` file in the root of the `case-study-platform` directory.
    *   Add your API key to this file:
        ```
        GEMINI_API_KEY=your_api_key_here
        ```
    *   **Important**: The `.env.local` file is included in `.gitignore` and should never be committed to version control.

### 1.2. Dependencies

The application uses the **latest** `@google/genai` package (not the older `@google/generative-ai`) to interact with the Gemini API. This provides access to the newest models and features.

To install the correct package:

```bash
npm uninstall @google/generative-ai  # Remove old package if present
npm install @google/genai            # Install new package
```

## 2. Building AI Features

### 2.1. Gemini Service Module

The core Gemini integration is located in `src/lib/ai/gemini.ts`. This module initializes the Gemini client and exports functions for interacting with the API.

### 2.2. Generating Content

For general-purpose content generation, use the `generateContent` function:

```typescript
import { generateContent } from "@/lib/ai/gemini";

async function getAIResponse(prompt: string) {
  try {
    const response = await generateContent(prompt);
    console.log(response);
  } catch (error) {
    console.error("Error generating content:", error);
  }
}
```

### 2.3. Student Assessment

For assessing student responses, use the `assessWithGemini` function. This function is specifically designed to provide structured feedback based on defined milestones.

```typescript
import { assessWithGemini } from "@/lib/ai/gemini";
import { AssessmentRequest, DEFAULT_MILESTONES } from "@/lib/ai/assessment";

async function assessStudent(studentResponse: string) {
  const request: AssessmentRequest = {
    studentResponse,
    question: "Explain the importance of photosynthesis.",
    context: "A high school biology class.",
    maxPoints: 10,
  };

  try {
    const result = await assessWithGemini(request, DEFAULT_MILESTONES);
    console.log("Assessment Score:", result.score);
    console.log("Feedback:", result.feedback);
    console.log("Milestones:", result.milestones);
  } catch (error) {
    console.error("Error assessing student response:", error);
  }
}
```

### 2.4. Response Summarization

For summarizing multiple student responses to text questions, use the `summarizeResponses` function. This is particularly useful in the presentation view to get AI-powered insights into student understanding.

```typescript
import { summarizeResponses } from "@/lib/ai/gemini";

async function summarizeStudentResponses() {
  const responses = [
    { studentName: "Alice", response: "Photosynthesis is crucial because it produces oxygen..." },
    { studentName: "Bob", response: "Plants use sunlight to make food through photosynthesis..." },
    // ... more responses
  ];

  try {
    const result = await summarizeResponses({
      questionText: "Explain the importance of photosynthesis.",
      responses,
      context: "High school biology lesson on plant processes"
    });

    console.log("Summary:", result.summary);
    console.log("Key Themes:", result.keyThemes);
    console.log("Teaching Insights:", result.insights);
  } catch (error) {
    console.error("Error summarizing responses:", error);
  }
}
```

The summarization feature is automatically available in the presentation view for text questions with 2 or more responses.

### 2.5. Creating New AI Functions

When creating new AI-powered features, follow these best practices:

*   **Centralize API Calls**: Add new functions to `src/lib/ai/gemini.ts` to keep all Gemini-related code in one place.
*   **Structured Prompts**: Design clear and detailed prompts to guide the AI's response. Use a consistent structure for similar tasks.
*   **JSON Output**: For complex data, instruct the model to return a JSON object. This makes the output predictable and easier to parse.
*   **Error Handling**: Implement robust error handling to manage API failures or unexpected responses.

## 3. Deployment

### 3.1. Environment Variables

When deploying the application, you need to configure the `GEMINI_API_KEY` as an environment variable in your hosting provider's settings.

*   **Vercel**: Go to **Project Settings > Environment Variables** and add `GEMINI_API_KEY`.
*   **Netlify**: Go to **Site settings > Build & deploy > Environment** and add `GEMINI_API_KEY`.
*   **Firebase/Google Cloud**: Refer to the respective documentation for setting environment variables for Cloud Functions or other services.

### 3.2. Server-Side Usage

All Gemini API calls should be made from server-side code (e.g., API routes, server components in Next.js, or Cloud Functions). **Never expose your API key on the client side.**

### 3.3. Available API Routes

The platform includes several API routes for AI functionality:

#### Assessment API Route

Here is an example of how to use the `assessWithGemini` function in a Next.js API route (`src/app/api/assess/route.ts`):

```typescript
import { NextResponse } from "next/server";
import { assessWithGemini } from "@/lib/ai/gemini";
import { AssessmentRequest } from "@/lib/ai/assessment";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assessmentRequest: AssessmentRequest = {
      studentResponse: body.studentResponse,
      question: body.question,
      context: body.context,
      maxPoints: body.maxPoints,
    };

    const result = await assessWithGemini(assessmentRequest);
    return NextResponse.json(result);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to process assessment" },
      { status: 500 }
    );
  }
}
```

#### Response Summarization API Route

The platform includes a built-in API route for response summarization at `/api/summarize-responses`:

```typescript
// POST /api/summarize-responses
{
  "questionText": "Explain the importance of photosynthesis.",
  "responses": [
    { "studentName": "Alice", "response": "Photosynthesis is crucial..." },
    { "studentName": "Bob", "response": "Plants use sunlight..." }
  ],
  "context": "High school biology lesson" // optional
}
```

Response format:
```typescript
{
  "summary": "A concise overview of student responses...",
  "keyThemes": ["Oxygen Production", "Energy Conversion", "Plant Biology"],
  "insights": [
    "Students show strong understanding of basic concepts",
    "Consider discussing the chemical equation in more detail"
  ]
}
```

## 4. Implemented Features

### 4.1. AI Response Summarization in Presentation View

The presentation view now includes automatic AI-powered summarization for text questions:

- **Trigger**: Appears for text questions with 2 or more student responses
- **Location**: Questions tab in presentation mode
- **Features**:
  - One-click summary generation using Gemini Flash 2.5
  - Key themes extraction
  - Teaching insights and recommendations
  - Regenerate capability for updated responses

### 4.2. Model Configuration

All AI functions now use **Gemini 2.5 Flash** (`gemini-2.5-flash`) with the new SDK for optimal performance and latest capabilities.

## 5. Lessons Learned & Best Practices

Based on implementing the AI response summarization feature, here are key insights for future AI implementations:

### 5.1. SDK and API Key Issues

**Common Problems:**
- Using outdated `@google/generative-ai` instead of newer `@google/genai`
- Invalid or placeholder API keys (real keys start with `AIzaSy` and are ~39 characters)
- Environment variables not loading correctly

**Solutions:**
- Always use the latest `@google/genai` package
- Test API keys with a simple test script before implementing
- Ensure `.env.local` is in the correct directory and properly formatted
- Restart development server after changing environment variables

### 5.2. Response Parsing Challenges

**Problem:** Gemini 2.5 Flash wraps JSON responses in markdown code blocks:
```
```json
{"key": "value"}
```
```

**Solution:** Always clean response text before parsing:
```typescript
let responseText = response.text || '{}';
responseText = responseText.replace(/```json\s*|\s*```/g, '');
const jsonResponse = JSON.parse(responseText);
```

### 5.3. Prompt Engineering for Different Audiences

**Key Insight:** Consider who will see the AI output when crafting prompts.

**Teacher-focused prompts** (for dashboards/analytics):
- Use pedagogical language
- Focus on assessment and improvement
- Include teaching recommendations

**Student-facing prompts** (for presentation views):
- Use encouraging, inclusive language
- Avoid evaluative or critical language
- Focus on collective insights and patterns
- Validate different perspectives

### 5.4. Optimizing for Live Teaching

**Problem:** Initial outputs were too verbose for quick scanning during live classes.

**Solution:** Use strict constraints in prompts:
- Summary: Maximum 15-20 words
- Themes: Exactly 3-4 themes, 2-3 words each
- Insights: 2-3 insights, 8-12 words each
- Target total reading time: ~10 seconds

### 5.5. Error Handling Strategy

**Always implement:**
1. **Graceful fallbacks** for API failures
2. **Detailed error logging** for debugging
3. **User-friendly error messages** that don't expose technical details
4. **Retry mechanisms** for transient failures

### 5.6. Development Workflow

**Recommended approach:**
1. **Start with simple test scripts** to verify API connectivity
2. **Create the core service function** in `gemini.ts`
3. **Build the API route** with proper validation
4. **Implement UI integration** last
5. **Add comprehensive error handling** throughout
6. **Clean up debugging logs** before production

### 5.7. Prompt Structure Best Practices

**Effective prompt structure:**
```
Context and question → Student responses → Clear output format → Strict constraints
```

**Use specific constraints:**
- Word limits for each section
- Exact number of items required
- Clear formatting requirements
- Audience-appropriate language guidelines

## 6. Usage Guidelines

This guide provides the foundational knowledge for integrating Gemini AI into the platform. As you develop new features, remember to prioritize security, maintainability, and a positive user experience.

### Key Benefits of the Current Implementation:
- **Real-time insights** during live sessions
- **Classroom-appropriate content** with audience-aware prompting
- **Seamless integration** into existing presentation workflow
- **Error handling** with fallback responses
- **Performance optimized** with Gemini 2.5 Flash model
- **Quick scanning** optimized for live teaching scenarios

## 7. Troubleshooting Common Issues

### 7.1. "Module not found: Can't resolve '@google/generative-ai'"
**Solution:** Update to the new SDK:
```bash
npm uninstall @google/generative-ai
npm install @google/genai
```

### 7.2. "API key not valid" Error
**Check:**
- API key starts with `AIzaSy` and is ~39 characters long
- `.env.local` file is in the `case-study-platform` directory
- No extra spaces or quotes around the API key
- Development server was restarted after adding the key

**Test with:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log('Key:', process.env.GEMINI_API_KEY?.substring(0,10)+'...');"
```

### 7.3. AI Returns Fallback Error Messages
**Common causes:**
- JSON parsing fails due to markdown code blocks
- Prompt is too complex or unclear
- API rate limits exceeded

**Debug by:**
- Adding `console.log(response.text)` before JSON parsing
- Testing with simpler prompts first
- Checking API usage in Google AI Studio

### 7.4. Output Too Verbose for Classroom Use
**Solution:** Add strict constraints to prompts:
```typescript
**Critical Requirements:**
- Summary: MAXIMUM 15-20 words, one sentence only
- Key Themes: Exactly 3-4 themes, 2-3 words each maximum
- Insights: Exactly 2-3 insights, 8-12 words each maximum
```

### 7.5. Development Server Issues
**If changes don't appear:**
- Restart the development server
- Clear browser cache
- Check console for build errors
- Verify file paths and imports

### 7.6. Quick Test Script
Create `test-gemini.js` for debugging:
```javascript
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }],
  });
  console.log('Response:', response.text);
}

test().catch(console.error);
```
