'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOutUser } from '@/lib/firebase/auth';
import { prepareProfileImage, removeTeacherProfilePhoto, updateTeacherProfile } from '@/lib/firebase/teacher-profile';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getTeacherNotificationPreferences,
  saveTeacherNotificationPreferences,
} from '@/lib/firebase/notification-preferences';
import { getUserFacingError } from '@/lib/user-facing-error';
import type { TeacherNotificationPreferences } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ArrowRight,
  Eye,
  Mail,
} from 'lucide-react';

type NotificationPreferenceKey = keyof TeacherNotificationPreferences;

function EmailPreferenceToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 rounded-2xl border border-[#e3e5ed] bg-white px-4 py-4 transition-colors hover:border-[#cfcbf8] has-[:focus-visible]:border-[#5146e5] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#5146e5]/15">
      <span>
        <span className="block text-sm font-bold text-[#101a38]">{label}</span>
        <span className="mt-1 block max-w-2xl text-sm leading-6 text-[#697087]">{description}</span>
      </span>
      <span className="relative mt-1 inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-[#dfe1e8] transition-colors peer-checked:bg-[#5146e5] peer-disabled:opacity-50" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<TeacherNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savedNotificationPreferences, setSavedNotificationPreferences] = useState<TeacherNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsNotice, setNotificationsNotice] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [localTimeZone, setLocalTimeZone] = useState('your local time');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (!user) return;
    setProfileData({ name: user.name || '', email: user.email || '' });
  }, [user]);

  useEffect(() => {
    try {
      setLocalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' '));
    } catch {
      setLocalTimeZone('your local time');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setNotificationsLoading(true);

    getTeacherNotificationPreferences()
      .then((preferences) => {
        if (!active) return;
        setNotificationPreferences(preferences);
        setSavedNotificationPreferences(preferences);
      })
      .catch((error) => {
        if (!active) return;
        setNotificationsError(getUserFacingError(error, 'Your email preferences could not be loaded. Try refreshing this page.'));
      })
      .finally(() => {
        if (active) setNotificationsLoading(false);
      });

    return () => {
      active = false;
    };
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

  const notificationPreferencesChanged = (
    Object.keys(notificationPreferences) as NotificationPreferenceKey[]
  ).some((key) => notificationPreferences[key] !== savedNotificationPreferences[key]);

  const changeNotificationPreference = (key: NotificationPreferenceKey, checked: boolean) => {
    setNotificationsNotice(null);
    setNotificationsError(null);
    setNotificationPreferences((current) => ({ ...current, [key]: checked }));
  };

  const handleNotificationPreferencesSave = async () => {
    setNotificationsSaving(true);
    setNotificationsNotice(null);
    setNotificationsError(null);
    try {
      await saveTeacherNotificationPreferences(notificationPreferences);
      setSavedNotificationPreferences(notificationPreferences);
      setNotificationsNotice('Email preferences saved.');
    } catch (error) {
      setNotificationsError(getUserFacingError(error, 'Your email preferences could not be saved. Try again.'));
    } finally {
      setNotificationsSaving(false);
    }
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

            {/* Email report settings */}
            <Card id="email-reports" className="scroll-mt-8 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#5146e5]" />
                  Email reports
                </CardTitle>
                <CardDescription>
                  Choose what Classfully sends to {user?.email || 'your account email'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-[#dcd8ff] bg-[#f7f5ff] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#5146e5] shadow-sm">
                      <Mail className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#101a38]">Useful signals, not another stream of alerts.</p>
                      <p className="mt-1 text-sm leading-6 text-[#697087]">Classfully waits until there is a complete class picture, then sends a concise report you can act on.</p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/settings/email-preview"
                    className="seminar-focus mt-4 inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[#d7d4ef] bg-white px-4 py-2 text-sm font-semibold text-[#313950] transition-colors hover:bg-[#eeecff] sm:mt-0"
                  >
                    <Eye className="h-4 w-4" />
                    Preview reports
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3" aria-busy={notificationsLoading}>
                  <EmailPreferenceToggle
                    label="After-class summary"
                    description="A practical recap after a class ends, including attendance, participation, open questions, and suggested next steps."
                    checked={notificationPreferences.afterClassReport}
                    disabled={notificationsLoading || notificationsSaving}
                    onChange={(checked) => changeNotificationPreference('afterClassReport', checked)}
                  />
                  <EmailPreferenceToggle
                    label="Weekly summary"
                    description={`One email that connects the week’s classes. It arrives Monday at 8:00 AM in your local time (${localTimeZone}). Nothing is sent during weeks without a completed class.`}
                    checked={notificationPreferences.weeklyCourseDigest}
                    disabled={notificationsLoading || notificationsSaving}
                    onChange={(checked) => changeNotificationPreference('weeklyCourseDigest', checked)}
                  />
                  <EmailPreferenceToggle
                    label="Product news"
                    description="Occasional notes about useful additions to Classfully. This stays off unless you choose it."
                    checked={notificationPreferences.productNews}
                    disabled={notificationsLoading || notificationsSaving}
                    onChange={(checked) => changeNotificationPreference('productNews', checked)}
                  />
                </div>

                <div className="flex flex-col gap-4 border-t border-[#e3e5ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs leading-5 text-[#697087]">Email reports use class-level totals. Student names and individual responses stay inside Classfully.</p>
                    {notificationsNotice && <p role="status" className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#2f6f43]"><CheckCircle2 className="h-4 w-4" />{notificationsNotice}</p>}
                    {notificationsError && <p role="alert" className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#a44534]"><AlertCircle className="h-4 w-4" />{notificationsError}</p>}
                  </div>
                  <Button
                    type="button"
                    loading={notificationsSaving}
                    disabled={notificationsLoading || !notificationPreferencesChanged}
                    onClick={handleNotificationPreferencesSave}
                    className="shrink-0"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save email preferences
                  </Button>
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
