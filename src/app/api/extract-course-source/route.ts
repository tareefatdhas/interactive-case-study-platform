import { NextRequest, NextResponse } from 'next/server';
import { extractPdfTeachingText } from '@/lib/ai/gemini';
import { MAX_COURSE_SOURCE_CHARS } from '@/lib/course-sources';
import { firebaseRequestError, requireFirebaseUser } from '@/lib/firebase/server-auth';

const MAX_PDF_BYTES = 6 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await requireFirebaseUser(request, { requestsPerMinute: 6 });
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose a PDF to add.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Use a PDF, or paste the relevant text instead.' }, { status: 415 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'Choose a PDF smaller than 6 MB, or paste the relevant section.' }, { status: 413 });
    }
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const content = (await extractPdfTeachingText(data, file.name)).trim().slice(0, MAX_COURSE_SOURCE_CHARS);
    if (content.length < 80) {
      return NextResponse.json({ error: 'Not enough readable text was found in that PDF.' }, { status: 422 });
    }
    return NextResponse.json({ content, fileName: file.name, extractedWithAi: true });
  } catch (error) {
    const authError = firebaseRequestError(error);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });
    console.error('Course source extraction failed:', error);
    return NextResponse.json({ error: 'That PDF could not be prepared. Paste the relevant text instead.' }, { status: 500 });
  }
}
