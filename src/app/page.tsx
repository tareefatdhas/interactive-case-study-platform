'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import Button from '@/components/ui/Button';
import { BookOpen, Users, QrCode, BarChart } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="text-center relative z-10">
            <div className="inline-flex items-center justify-center px-4 py-2 mb-8 text-sm font-medium text-blue-900 bg-blue-100 rounded-full border border-blue-200">
              <BookOpen className="w-4 h-4 mr-2" />
              Transform Your Teaching Experience
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 mb-8 leading-tight">
              Interactive Case
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                Studies
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              The most beautiful and intuitive platform for delivering interactive 
              case studies with <span className="font-semibold text-gray-800">student grade tracking</span>.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="px-10 py-5 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-10 py-5 text-lg font-semibold border-2 hover:bg-slate-50 transition-all duration-300"
                >
                  Sign In
                </Button>
              </Link>
            </div>
            
            <div className="text-sm text-gray-500 flex items-center justify-center gap-6">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                No credit card required
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Free forever plan
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Everything you need for engaging case studies
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Streamline your teaching with modern tools designed for student engagement 
              and <span className="font-semibold text-gray-800">easy grading</span>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="group text-center p-8 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">QR Code Access</h3>
              <p className="text-gray-600 leading-relaxed">Students join instantly by scanning a QR code. No passwords required.</p>
            </div>

            <div className="group text-center p-8 bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl border border-green-100 hover:shadow-xl hover:border-green-200 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Progressive Reading</h3>
              <p className="text-gray-600 leading-relaxed">Content delivered section by section with embedded questions.</p>
            </div>

            <div className="group text-center p-8 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl border border-purple-100 hover:shadow-xl hover:border-purple-200 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 text-white rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Student Tracking</h3>
              <p className="text-gray-600 leading-relaxed">Track participation and grades over time with detailed analytics.</p>
            </div>

            <div className="group text-center p-8 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 text-white rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <BarChart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-time Analytics</h3>
              <p className="text-gray-600 leading-relaxed">Monitor class progress and engagement with live insights.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-purple-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="inline-flex items-center justify-center px-4 py-2 mb-8 text-sm font-medium text-blue-200 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Users className="w-4 h-4 mr-2" />
              Join 10,000+ Educators
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Ready to transform your 
              <span className="block">case study teaching?</span>
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join educators who are already creating more engaging learning experiences 
              and seeing <span className="font-semibold text-white">measurable improvements</span> in student participation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/signup">
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="px-10 py-5 text-lg font-semibold bg-white text-blue-900 hover:bg-gray-50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  Start Your Free Account
                </Button>
              </Link>
              <div className="text-sm text-blue-200">
                Setup in under 5 minutes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-blue-400 mr-3" />
              <span className="text-xl font-bold">Interactive Case Studies</span>
            </div>
            <p className="text-gray-400 mb-4">
              © 2024 Interactive Case Study Platform. Built with passion for education.
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <span className="flex items-center">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                All systems operational
              </span>
              <span>•</span>
              <span>99.9% uptime</span>
              <span>•</span>
              <span>Enterprise ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}