'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOutUser } from '@/lib/firebase/auth';
import { prepareProfileImage, removeTeacherProfilePhoto, updateTeacherProfile } from '@/lib/firebase/teacher-profile';
import { getUserFacingError } from '@/lib/user-facing-error';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import InstructorAvatar from '@/components/teacher/InstructorAvatar';
import { 
  User, 
  Lock, 
  Bell, 
  Trash2, 
  Save,
  LogOut,
  Shield,
  Settings as SettingsIcon,
  Camera,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (!user) return;
    setProfileData({ name: user.name || '', email: user.email || '' });
  }, [user]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProfileNotice(null);
    setProfileError(null);
    
    try {
      await updateTeacherProfile(profileData.name, photoFile);
      await refreshUser();
      setPhotoFile(null);
      setPhotoPreview(null);
      setProfileNotice('Profile saved. Your instructor workspace is up to date.');
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileError(getUserFacingError(error, 'Your profile could not be saved. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setPhotoLoading(true);
    setProfileNotice(null);
    setProfileError(null);
    try {
      const prepared = await prepareProfileImage(file);
      setPhotoFile(prepared);
      setPhotoPreview(URL.createObjectURL(prepared));
    } catch (error) {
      setProfileError(getUserFacingError(error, 'That photo could not be prepared. Choose another image.'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePhotoRemoval = async () => {
    setProfileNotice(null);
    setProfileError(null);

    if (photoFile) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    setPhotoLoading(true);
    try {
      await removeTeacherProfilePhoto();
      await refreshUser();
      setProfileNotice('Profile photo removed. Your initials are now shown.');
    } catch (error) {
      setProfileError(getUserFacingError(error, 'Your profile photo could not be removed. Try again.'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-5xl p-6 lg:p-10">
          {/* Header */}
          <div className="mb-8">
            <p className="seminar-eyebrow mb-2">Your account</p>
            <h1 className="seminar-display text-4xl text-[#101a38]">Settings</h1>
            <p className="mt-2 text-sm leading-6 text-[#697087]">
              Choose how you appear in your instructor workspace and manage your account.
            </p>
          </div>

          <div className="space-y-6">
            {/* Profile Settings */}
            <Card className="overflow-hidden">
              <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="flex flex-col items-center justify-center border-b border-[#e3e5ed] bg-[#f8f7ff] px-6 py-8 text-center lg:border-b-0 lg:border-r">
                  <div className="relative">
                    <InstructorAvatar name={profileData.name || user?.name} photoURL={photoPreview || user?.photoURL} size={112} className="ring-4 ring-white shadow-[0_14px_35px_rgba(28,35,75,0.14)]" />
                    <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoLoading || loading} className="seminar-focus absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-[#f8f7ff] bg-[#5146e5] text-white shadow-md transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-60" aria-label={user?.photoURL || photoPreview ? 'Choose a different profile photo' : 'Add profile photo'}>
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <strong className="mt-5 text-sm text-[#101a38]">{photoPreview ? 'New photo ready' : user?.photoURL ? 'Your profile photo' : 'Add a profile photo'}</strong>
                  <p className="mt-1 max-w-[190px] text-xs leading-5 text-[#697087]">Shown on your dashboard and instructor console. Students do not see it.</p>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhotoSelection} aria-label="Profile photo file" />
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={photoLoading || loading} className="gap-2">
                      <ImagePlus className="h-4 w-4" /> {photoLoading ? 'Preparing...' : user?.photoURL || photoPreview ? 'Change' : 'Upload photo'}
                    </Button>
                    {(user?.photoURL || photoPreview) && <Button type="button" size="sm" variant="ghost" onClick={handlePhotoRemoval} disabled={photoLoading || loading}>Remove</Button>}
                  </div>
                  <p className="mt-3 text-[11px] text-[#8a90a2]">JPG, PNG, or WebP. Up to 8 MB.</p>
                </div>
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-[#5146e5]" />
                      Instructor profile
                    </CardTitle>
                    <CardDescription>
                      Use the name you want to see while running a class.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input
                          label="Instructor name"
                          name="name"
                          value={profileData.name}
                          onChange={handleInputChange}
                          placeholder="How should Classfully address you?"
                          required
                        />
                        <Input
                          label="Account email"
                          name="email"
                          type="email"
                          value={profileData.email}
                          onChange={handleInputChange}
                          placeholder="Enter your email"
                          disabled
                        />
                      </div>
                      {profileNotice && <div role="status" className="flex items-start gap-2 rounded-xl bg-[#edf8ef] px-4 py-3 text-sm leading-5 text-[#2f6f43]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{profileNotice}</div>}
                      {profileError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#efc8bf] bg-[#fff6f2] px-4 py-3 text-sm leading-5 text-[#a44534]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{profileError}</div>}
                      <div className="flex justify-end">
                        <Button type="submit" loading={loading} disabled={photoLoading || !profileData.name.trim()}>
                          <Save className="mr-2 h-4 w-4" />
                          Save profile
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </div>
              </div>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security & Privacy
                </CardTitle>
                <CardDescription>
                  Manage your password and security preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Password</h4>
                    <p className="text-sm text-gray-600">
                      Last changed 30 days ago
                    </p>
                  </div>
                  <Button variant="outline">
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    <Shield className="w-4 h-4 mr-2" />
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Session Updates</h4>
                      <p className="text-sm text-gray-600">
                        Notifications when students join or complete sessions
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Weekly Reports</h4>
                      <p className="text-sm text-gray-600">
                        Weekly summary of your case study performance
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Product Updates</h4>
                      <p className="text-sm text-gray-600">
                        News about new features and improvements
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="w-5 h-5 mr-2" />
                  Account Management
                </CardTitle>
                <CardDescription>
                  Manage your account and data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Export Data</h4>
                    <p className="text-sm text-gray-600">
                      Download all your case studies and session data
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    Export Data
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Sign Out</h4>
                    <p className="text-sm text-gray-600">
                      Sign out of your account on this device
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                  <div>
                    <h4 className="font-medium text-red-900">Delete Account</h4>
                    <p className="text-sm text-red-600">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" disabled>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
