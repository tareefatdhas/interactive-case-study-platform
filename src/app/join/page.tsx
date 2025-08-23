'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionByCode } from '@/lib/firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { QrCode, ArrowRight, Users } from 'lucide-react';

export default function JoinPage() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const session = await getSessionByCode(sessionCode.toUpperCase());
      
      if (!session) {
        throw new Error('Session not found. Please check your code and try again.');
      }

      if (!session.active) {
        throw new Error('This session is no longer active.');
      }

      // Redirect to session page
      router.push(`/session/${session.sessionCode}`);
    } catch (error: any) {
      setError(error.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const handleScanQR = () => {
    // In a real app, this would open camera for QR scanning
    // For now, we'll simulate it
    alert('QR Scanner would open here. For demo, please enter the code manually.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Join Case Study
          </h1>
          <p className="mt-2 text-gray-600">
            Enter your session code or scan the QR code to get started
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session Access</CardTitle>
            <CardDescription>
              Enter the 6-digit code shared by your instructor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinSession} className="space-y-6">
              <div className="space-y-4">
                <Input
                  label="Session Code"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="text-center text-lg font-mono tracking-widest"
                  required
                />

                {error && (
                  <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    loading={loading}
                    className="flex-1 flex items-center justify-center"
                  >
                    Join Session
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleScanQR}
                    className="px-4"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Don't have a session code?
                </p>
                <p className="text-xs text-gray-500">
                  Ask your instructor to share the session code or QR code with the class.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Having trouble? Contact your instructor for help.
          </p>
        </div>
      </div>
    </div>
  );
}