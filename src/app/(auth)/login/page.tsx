'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInTeacher } from '@/lib/firebase/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SeminarAuthShell from '@/components/ui/SeminarAuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInTeacher(formData.email, formData.password);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setError(message || 'We could not sign you in. Check your email and password, then try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <SeminarAuthShell eyebrow="Instructor sign in" title="Welcome back." description="Sign in to prepare a lesson, open your classroom display, or continue a live class.">
      <div className="rounded-2xl border border-[#e3e5ed] bg-white p-6 shadow-[0_18px_50px_rgba(16,26,56,0.06)] sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="email"
                placeholder="you@university.edu"
              />
              
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                autoComplete="current-password"
                placeholder="Your password"
              />

              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">Sign in</Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-[#5146e5] hover:text-[#4137c7]"
                >
                  Create one
                </Link>
              </p>
              <Link
                href="/forgot-password"
                className="mt-2 inline-block text-sm text-[#697087] hover:text-[#313950]"
              >
                Forgot your password?
              </Link>
            </div>
      </div>
    </SeminarAuthShell>
  );
}
