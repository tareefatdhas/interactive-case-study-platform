'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, Mail, Monitor, Smartphone } from 'lucide-react';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { classfullyEmailPreviewSamples } from '@/lib/email/classfully-email';

type PreviewType = keyof typeof classfullyEmailPreviewSamples;

const previewOptions: Array<{ id: PreviewType; label: string; description: string; delivery: string }> = [
  {
    id: 'welcome',
    label: 'Instructor welcome',
    description: 'Helps a new instructor set up their first class.',
    delivery: 'After sign-up',
  },
  {
    id: 'teachingTeamWelcome',
    label: 'Teaching-team welcome',
    description: 'Opens the course or workspace an invited instructor joined.',
    delivery: 'After accepting an invitation',
  },
  {
    id: 'afterClass',
    label: 'After-class summary',
    description: 'Shows what happened in a finished class.',
    delivery: 'After class',
  },
  {
    id: 'weeklyDigest',
    label: 'Weekly summary',
    description: 'Brings the week’s classes into one clear view.',
    delivery: 'Weekly',
  },
  {
    id: 'productNews',
    label: 'Product note',
    description: 'Shares useful changes to Classfully.',
    delivery: 'When opted in',
  },
  {
    id: 'passwordReset',
    label: 'Password reset',
    description: 'Provides a secure link to choose a new password.',
    delivery: 'On request',
  },
];

export default function EmailPreviewPage() {
  const [previewType, setPreviewType] = useState<PreviewType>('welcome');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const preview = classfullyEmailPreviewSamples[previewType];
  const selectedOption = previewOptions.find((option) => option.id === previewType);

  const gallery = (
    <main className="min-h-screen bg-[#f8f7f3] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/dashboard/settings#email-reports"
              className="seminar-focus inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] hover:text-[#101a38]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </Link>

            <div className="mt-6">
              <header className="max-w-3xl">
                <p className="seminar-eyebrow">Instructor email</p>
                <h1 className="seminar-display mt-2 text-4xl leading-tight text-[#101a38]">Preview every email.</h1>
                <p className="mt-3 text-sm leading-6 text-[#697087]">
                  See exactly what instructors receive. Check the subject and desktop or mobile layout. Reports only show data that was collected.
                </p>
              </header>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6" role="radiogroup" aria-label="Email to preview">
                  {previewOptions.map((option) => {
                    const selected = option.id === previewType;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPreviewType(option.id)}
                        className={`seminar-focus min-h-[76px] w-full rounded-2xl border p-3 text-left transition-colors ${
                          selected
                            ? 'border-[#5146e5] bg-[#eeecff] text-[#101a38]'
                            : 'border-[#e3e5ed] bg-white text-[#697087] hover:border-[#c9c6f7]'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          {selected ? <Eye className="h-4 w-4 text-[#5146e5]" /> : <Mail className="h-4 w-4" />}
                          {option.label}
                        </span>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] ${selected ? 'bg-white/75 text-[#5146e5]' : 'bg-[#f6f5f2] text-[#697087]'}`}>
                          {option.delivery}
                        </span>
                      </button>
                    );
                  })}
                </div>

              <section className="mt-5" aria-label={`${selectedOption?.label} preview`}>
                <div className="rounded-2xl border border-[#e3e5ed] bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#101a38]">{selectedOption?.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#697087]">{selectedOption?.description}</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-[#dfe1ea] bg-white p-1" aria-label="Preview size">
                    <button
                      type="button"
                      onClick={() => setViewport('desktop')}
                      aria-pressed={viewport === 'desktop'}
                      className={`seminar-focus inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${viewport === 'desktop' ? 'bg-[#eeecff] text-[#5146e5]' : 'text-[#697087]'}`}
                    >
                      <Monitor className="h-4 w-4" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewport('mobile')}
                      aria-pressed={viewport === 'mobile'}
                      className={`seminar-focus inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${viewport === 'mobile' ? 'bg-[#eeecff] text-[#5146e5]' : 'text-[#697087]'}`}
                    >
                      <Smartphone className="h-4 w-4" /> Mobile
                    </button>
                  </div>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-[#ececf1] pt-4 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5146e5]">Subject</p>
                      <p className="mt-1 text-xs leading-5 text-[#4f5871]">{preview.subject}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5146e5]">Inbox preview</p>
                      <p className="mt-1 text-xs leading-5 text-[#4f5871]">{preview.previewText}</p>
                    </div>
                  </div>
                </div>
                <div className={`mx-auto mt-4 overflow-hidden rounded-[28px] border border-[#dfe1ea] bg-[#ece9e3] shadow-[0_20px_55px_rgba(16,26,56,0.10)] transition-[max-width] ${viewport === 'mobile' ? 'max-w-[430px]' : 'max-w-none'}`}>
                  <div className="flex items-center justify-between border-b border-[#d8d6d1] bg-white px-5 py-3">
                    <div className="flex gap-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#df664e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f4c94e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#73c696]" />
                    </div>
                    <span className="text-xs font-semibold text-[#697087]">Email preview</span>
                  </div>
                  <iframe
                    key={previewType}
                    title={`${selectedOption?.label} email`}
                    srcDoc={preview.html}
                    sandbox=""
                    className="block h-[860px] w-full bg-[#f5f3ef]"
                  />
                </div>
              </section>
            </div>
          </div>
    </main>
  );

  if (process.env.NODE_ENV === 'development') return gallery;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {gallery}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
