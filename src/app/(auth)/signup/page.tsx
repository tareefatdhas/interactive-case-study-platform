'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getGoogleSignInErrorMessage,
  signInTeacherWithGoogle,
  signUpTeacher,
} from '@/lib/firebase/auth';
import Button from '@/components/ui/Button';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import Input from '@/components/ui/Input';
import SeminarAuthShell from '@/components/ui/SeminarAuthShell';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      await signInTeacherWithGoogle();
      router.push('/dashboard');
    } catch (error: unknown) {
      setError(getGoogleSignInErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('The passwords do not match.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Use at least 6 characters for your password.');
      setLoading(false);
      return;
    }

    try {
      await signUpTeacher(formData.email, formData.password, formData.name);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setError(message || 'We could not create your account. Check the details and try again.');
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
    <SeminarAuthShell eyebrow="Instructor account" title="Create your instructor account." description="Add your course after this, then prepare your first live classroom session.">
      <div className="rounded-2xl border border-[#e3e5ed] bg-white p-6 shadow-[0_18px_50px_rgba(16,26,56,0.06)] sm:p-7">
            <GoogleSignInButton
              disabled={loading}
              loading={googleLoading}
              onClick={handleGoogleSignIn}
            />

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[#e3e5ed]" />
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#8a90a2]">
                Or continue with email
              </span>
              <span className="h-px flex-1 bg-[#e3e5ed]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Maya Chen"
              />

              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="you@university.edu"
              />
              
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="At least 6 characters"
                helperText="Use at least 6 characters."
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Type it again"
              />

              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                disabled={googleLoading}
                className="w-full"
              >
                Create account
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[#5146e5] hover:text-[#4137c7]"
                >
                  Sign in
                </Link>
              </p>
            </div>
      </div>
    </SeminarAuthShell>
  );
}
