import { NextRequest, NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';
import { firebaseRequestError, requireFirebaseUser } from '@/lib/firebase/server-auth';
import { MAX_COMBINED_SOURCE_CHARS } from '@/lib/course-sources';

const interactionTypes = ['pulse', 'poll', 'quiz', 'open-response'] as const;

type InteractionType = (typeof interactionTypes)[number];

type GeneratedInteraction = {
  type: InteractionType;
  title: string;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  plannedTime: string;
  durationMinutes: number;
  resultVisibility: 'live' | 'after-reveal' | 'instructor-only';
};

function stringValue(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseJsonResponse(response: string): unknown {
  const withoutFence = response.replace(/```json\s*|```/gi, '').trim();
  const match = withoutFence.match(/\{[\s\S]*\}/);
  return JSON.parse(match?.[0] || withoutFence);
}

function validateInteraction(value: unknown): GeneratedInteraction | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const type = candidate.type;
  if (!interactionTypes.includes(type as InteractionType)) return null;
  const interactionType = type as InteractionType;

  const title = stringValue(candidate.title, 90);
  const prompt = stringValue(candidate.prompt, 360);
  const plannedTime = stringValue(candidate.plannedTime, 60) || 'During class';
  const rawDuration = Number(candidate.durationMinutes);
  const durationMinutes = Number.isFinite(rawDuration)
    ? Math.max(1, Math.min(20, Math.round(rawDuration)))
    : interactionType === 'open-response' ? 4 : 3;

  if (!title || !prompt) return null;

  if (interactionType === 'open-response') {
    return {
      type: interactionType,
      title,
      prompt,
      plannedTime,
      durationMinutes,
      resultVisibility: 'instructor-only',
    };
  }

  const options = Array.isArray(candidate.options)
    ? candidate.options.map((option) => stringValue(option, 120)).filter(Boolean).slice(0, 6)
    : [];
  if (options.length < 2) return null;

  if (interactionType === 'quiz') {
    const correctOptionIndex = Number(candidate.correctOptionIndex);
    const explanation = stringValue(candidate.explanation, 300);
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length || !explanation) {
      return null;
    }
    return {
      type: interactionType,
      title,
      prompt,
      options,
      correctOptionIndex,
      explanation,
      plannedTime,
      durationMinutes,
      resultVisibility: 'after-reveal',
    };
  }

  return {
    type: interactionType,
    title,
    prompt,
    options,
    plannedTime,
    durationMinutes,
    resultVisibility: 'live',
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireFirebaseUser(request, { requestsPerMinute: 6 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Send lesson material as JSON.' }, { status: 400 });
    }
    const requestBody = body as Record<string, unknown>;
    const lessonContent = stringValue(requestBody.lessonContent, MAX_COMBINED_SOURCE_CHARS);
    const sessionTitle = stringValue(requestBody.sessionTitle, 120);
    const courseName = stringValue(requestBody.courseName, 120);
    const courseCode = stringValue(requestBody.courseCode, 60);

    if (lessonContent.length < 80) {
      return NextResponse.json(
        { error: 'Add at least a short section of lesson material before generating questions.' },
        { status: 400 },
      );
    }

    const prompt = `
You help an instructor prepare a university class session. Use only the supplied lesson material. Write in plain classroom language. Do not invent facts, readings, learning outcomes, or source citations.

Class context:
- Course code: ${courseCode || 'Not provided'}
- Course name: ${courseName || 'Not provided'}
- Session title: ${sessionTitle || 'Not provided'}

Lesson material:
---
${lessonContent}
---

Create exactly four practical, editable interaction drafts, one of each type: pulse, poll, quiz, and open-response.

Requirements:
- The pulse is a quick check-in about confidence, pace, or readiness. Give 3 to 5 respectful options.
- The poll asks for a defensible interpretation, prioritisation, or application from this lesson. Give 3 to 5 plausible options.
- The quiz checks one important point in the lesson. Give 4 plausible options, one correct option index, and a short explanation that can be shown after the response.
- The open-response asks for a concise explanation, question, or application. It must be answerable in one or two sentences.
- Prompts must be specific to this lesson and understandable when shown on a projector.
- Keep titles under 8 words, prompts under 45 words, and options under 12 words each.
- Use resultVisibility: live for pulse/poll, after-reveal for quiz, instructor-only for open-response.
- Use realistic plannedTime labels such as "Opening", "After the example", or "Before discussion", and durations between 2 and 5 minutes.

Return JSON only, with this exact shape:
{
  "interactions": [
    {
      "type": "pulse",
      "title": "",
      "prompt": "",
      "options": [""],
      "plannedTime": "",
      "durationMinutes": 2,
      "resultVisibility": "live"
    }
  ]
}`;

    const generated = await generateContent(prompt);
    const parsed = parseJsonResponse(generated) as { interactions?: unknown };
    const interactions = Array.isArray(parsed.interactions)
      ? parsed.interactions.map(validateInteraction).filter((item): item is GeneratedInteraction => Boolean(item))
      : [];

    const expectedTypes = new Set(interactions.map((interaction) => interaction.type));
    if (interactions.length !== 4 || interactionTypes.some((type) => !expectedTypes.has(type))) {
      return NextResponse.json(
        { error: 'The draft was incomplete. Please try again with a little more lesson material.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ interactions });
  } catch (error) {
    const authError = firebaseRequestError(error);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });
    console.error('Session interaction generation failed:', error);
    return NextResponse.json(
      { error: 'The question drafts could not be generated. Check your connection and try again.' },
      { status: 500 },
    );
  }
}
