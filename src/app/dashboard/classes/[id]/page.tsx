'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCourse, deleteSession, getCourse, getCoursesByTeacher, getSessionsByTeacher, updateCourse } from '@/lib/firebase/firestore';
import { deleteInstructorClassroomData } from '@/lib/firebase/live-classroom';
import { TEAM_COLORS, addInstructorTeamMember, createInstructorCourseTeam, deleteInstructorCourseTeam, ensureTeamModule, normalizeTeamName, normalizeTeamStudentNumber, removeInstructorTeamMember, subscribeInstructorTeamRoster, updateInstructorCourseTeam, type CourseTeamWithMembers, type TeamColorId } from '@/lib/firebase/course-teams';
import { COURSE_SOURCE_KINDS, MAX_COURSE_SOURCES, MAX_COURSE_SOURCE_CHARS, courseSourceWordCount, removeCourseSource, upsertCourseSource } from '@/lib/course-sources';
import { getUserFacingError } from '@/lib/user-facing-error';
import { auth } from '@/lib/firebase/config';
import { Timestamp } from 'firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import InlineMessage from '@/components/ui/InlineMessage';
import type { Course, CourseSource, CourseSourceKind, Session, SessionInteraction, SessionInteractionType } from '@/types';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  ArchiveRestore,
  BarChart3,
  CalendarPlus,
  CalendarSync,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Cloud,
  Copy,
  Dices,
  FileText,
  HeartPulse,
  Library,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Play,
  Radio,
  Save,
  ShieldCheck,
  Sparkles,
  Repeat2,
  Trash2,
  Upload,
  Users,
  UsersRound,
  ExternalLink,
  Link2,
  X,
} from 'lucide-react';

interface ClassWorkspaceProps {
  params: Promise<{ id: string }>;
}

const interactionTypes: Array<{
  type: SessionInteractionType;
  label: string;
  use: string;
  icon: typeof HeartPulse;
}> = [
  { type: 'pulse', label: 'Pulse check', use: 'Read confidence, pace, or wellbeing.', icon: HeartPulse },
  { type: 'poll', label: 'Opinion poll', use: 'See where the room stands before discussion.', icon: BarChart3 },
  { type: 'quiz', label: 'Knowledge check', use: 'Catch a misconception while you can address it.', icon: CircleHelp },
  { type: 'open-response', label: 'Short response', use: 'Collect questions, reasoning, or reflection.', icon: MessageCircle },
  { type: 'word-cloud', label: 'Word cloud', use: 'Turn one-word responses into a live view of shared themes.', icon: Cloud },
  { type: 'team-formation', label: 'Form teams', use: 'Create named teams students can use throughout the course.', icon: UsersRound },
  { type: 'peer-learning', label: 'Peer learning', use: 'Answer, discuss with a partner, then answer again.', icon: Repeat2 },
  { type: 'group-work', label: 'Group work', use: 'Give groups a shared task and one submission.', icon: UsersRound },
  { type: 'timer', label: 'Clock', use: 'Save a timed thinking or working block.', icon: Clock3 },
  { type: 'spin-wheel', label: 'Spin the wheel', use: 'Choose a student, team, topic, or custom item live.', icon: Dices },
];

const createTemplate = (type: SessionInteractionType): SessionInteraction => ({
  id: `template-${type}-${Date.now()}`,
  type,
  title: interactionTypes.find((option) => option.type === type)?.label || 'Interaction',
  prompt: type === 'pulse'
    ? 'How confident do you feel right now?'
    : type === 'poll'
      ? 'Which option best matches your view?'
      : type === 'quiz'
      ? 'Choose the best answer.'
      : type === 'team-formation'
        ? 'Choose your team. If it is not listed yet, create it and add a short note.'
      : type === 'word-cloud'
        ? 'What one word best captures this idea?'
      : type === 'peer-learning'
          ? 'Choose the best answer. Discuss it with a partner, then answer again.'
          : type === 'group-work'
            ? 'Work together on this prompt. Choose one note-taker to submit.'
            : type === 'timer'
              ? 'Use this time to think, write, or complete the task on screen.'
              : type === 'spin-wheel'
                ? 'Who or what should go next?'
              : 'What question is still unresolved?',
  plannedTime: 'During class',
  durationMinutes: type === 'group-work' ? 8 : type === 'timer' ? 5 : type === 'open-response' ? 4 : type === 'word-cloud' || type === 'spin-wheel' ? 2 : 3,
  discussionMinutes: type === 'peer-learning' ? 2 : undefined,
  groupSize: type === 'group-work' ? 4 : undefined,
  teamTags: type === 'team-formation' ? ['Theme 1', 'Theme 2', 'Theme 3'] : undefined,
  requireTeamTag: type === 'team-formation' ? true : undefined,
  options: type === 'pulse'
    ? ['Still fuzzy', 'Getting there', 'Mostly got it', 'Confident', 'Could explain it']
    : type === 'poll' || type === 'quiz' || type === 'peer-learning'
      ? ['Option 1', 'Option 2', 'Option 3', 'Option 4']
      : undefined,
  correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? 0 : undefined,
  wheelSource: type === 'spin-wheel' ? 'students' : undefined,
  wheelItems: type === 'spin-wheel' ? [] : undefined,
  wheelRemoveSelected: type === 'spin-wheel' ? true : undefined,
  resultVisibility: type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' ? 'instructor-only' : 'live',
});

const readableDate = (value?: string) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ClassWorkspacePage({ params }: ClassWorkspaceProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionInteraction[]>([]);
  const [className, setClassName] = useState('');
  const [classTerm, setClassTerm] = useState('');
  const [courseTagsInput, setCourseTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'sessions' | 'teams' | 'library'>('sessions');
  const [teamRoster, setTeamRoster] = useState<CourseTeamWithMembers[]>([]);
  const [teamError, setTeamError] = useState('');
  const [teamErrorTitle, setTeamErrorTitle] = useState('Teams need another try.');
  const [teamLinkCopied, setTeamLinkCopied] = useState(false);
  const [teamCreatorOpen, setTeamCreatorOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamTag, setNewTeamTag] = useState('');
  const [newTeamColor, setNewTeamColor] = useState<TeamColorId>('violet');
  const [memberEditorTeamId, setMemberEditorTeamId] = useState('');
  const [newMemberNumber, setNewMemberNumber] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [removingMemberNumber, setRemovingMemberNumber] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<CourseTeamWithMembers | null>(null);
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceKind, setSourceKind] = useState<CourseSourceKind>('notes');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceExtractedWithAi, setSourceExtractedWithAi] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourceExtracting, setSourceExtracting] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<CourseSource | null>(null);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const syncedTeamRosterRef = useRef('');
  const [addOpen, setAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [rollingOver, setRollingOver] = useState(false);
  const [nextTerm, setNextTerm] = useState('');
  const [nextCode, setNextCode] = useState('');
  const [archiveAfterRollover, setArchiveAfterRollover] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if ((event.target as Element).closest('[data-overflow-menu]')) return;
      setClassMenuOpen(false);
      setSessionMenuOpen(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setClassMenuOpen(false);
      setSessionMenuOpen(null);
    };
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!user) return;
      try {
        const [courseData, sessionData] = await Promise.all([getCourse(id), getSessionsByTeacher(user.uid)]);
        if (!courseData || courseData.teacherId !== user.uid) {
          setError('This class could not be found.');
          return;
        }
        setCourse(courseData);
        setTemplates(courseData.interactionTemplates || []);
        setClassName(courseData.name);
        setClassTerm(courseData.term || '');
        setCourseTagsInput((courseData.teamTags || []).join(', '));
        setSessions(sessionData.filter((session) => session.courseId === id || (!session.courseId && session.courseCode === courseData.code)));
      } catch (loadError) {
        console.error('Could not load class workspace:', loadError);
        setError('The class workspace could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    loadWorkspace();
  }, [id, user]);

  useEffect(() => {
    if (workspaceView !== 'teams' || !course || !user || course.teacherId !== user.uid) return;
    let unsubscribe: () => void = () => {};
    let cancelled = false;
    syncedTeamRosterRef.current = JSON.stringify(course.teams || []);
    ensureTeamModule(course)
      .then(() => {
        if (cancelled) return;
        setTeamError('');
        unsubscribe = subscribeInstructorTeamRoster(course.id, user.uid, (roster) => {
        setTeamRoster(roster);
        const persistedTeams = roster.map(({ id: teamId, name, description, tag, color, creatorUid, members, memberCount }) => ({ id: teamId, name, description, tag, color, creatorUid, members: members.map(({ studentUid, studentNumber, displayName }) => ({ studentUid, studentNumber, displayName })), memberCount }));
        const nextKey = JSON.stringify(persistedTeams);
        if (nextKey !== syncedTeamRosterRef.current) {
          syncedTeamRosterRef.current = nextKey;
          void updateCourse(course.id, { teams: persistedTeams }).catch((syncError) => {
            syncedTeamRosterRef.current = '';
            console.error('Could not sync the team roster to this class:', syncError);
          });
        }
      }); })
      .catch((moduleError) => {
        if (cancelled) return;
        console.error('Could not prepare team registration:', moduleError);
        setTeamErrorTitle('Teams could not be opened.');
        setTeamError('Team registration could not be prepared. Refresh this page and try again.');
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [course, user, workspaceView]);

  const studentCount = useMemo(() => new Set(sessions.flatMap((session) => session.studentsJoined || [])).size, [sessions]);
  const normalizedNewTeamName = normalizeTeamName(newTeamName);
  const duplicateTeam = teamRoster.find((team) => team.normalizedName === normalizedNewTeamName && team.id !== editingTeamId);
  const orderedSessions = useMemo(() => [...sessions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return bTime - aTime;
  }), [sessions]);

  const resetTeamCreator = () => {
    setTeamCreatorOpen(false);
    setEditingTeamId('');
    setNewTeamName('');
    setNewTeamDescription('');
    setNewTeamTag('');
    setNewTeamColor('violet');
  };

  const editTeamForClass = (team: CourseTeamWithMembers) => {
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    setNewTeamDescription(team.description || '');
    setNewTeamTag(team.tag || '');
    setNewTeamColor(team.color || 'violet');
    setTeamError('');
    setTeamCreatorOpen(true);
  };

  const createTeamForClass = async () => {
    if (!course || !user || creatingTeam) return;
    if (normalizedNewTeamName.length < 2) {
      setTeamErrorTitle('Check the team name.');
      setTeamError('Add a team name with at least two letters or numbers.');
      return;
    }
    if (duplicateTeam) {
      setTeamErrorTitle('That team is already here.');
      setTeamError(`${duplicateTeam.name} is already in this class.`);
      return;
    }
    setCreatingTeam(true);
    setTeamError('');
    try {
      const teamModule = await ensureTeamModule(course);
      const existingTeam = teamRoster.find((team) => team.id === editingTeamId);
      if (existingTeam) {
        await updateInstructorCourseTeam({ team: existingTeam, name: newTeamName, description: newTeamDescription, tag: newTeamTag, color: newTeamColor });
      } else {
        await createInstructorCourseTeam({ module: teamModule, name: newTeamName, description: newTeamDescription, tag: newTeamTag, color: newTeamColor });
      }
      resetTeamCreator();
    } catch (createError) {
      console.error('Could not create team:', createError);
      setTeamErrorTitle('That team was not added.');
      setTeamError(createError instanceof Error ? createError.message : 'The team was not created. Check the details and try again.');
    } finally {
      setCreatingTeam(false);
    }
  };

  const openMemberEditor = (teamId: string) => {
    setMemberEditorTeamId((current) => current === teamId ? '' : teamId);
    setNewMemberNumber('');
    setNewMemberName('');
    setMemberError('');
  };

  const addMemberToTeam = async (team: CourseTeamWithMembers) => {
    if (memberSaving) return;
    const studentNumber = normalizeTeamStudentNumber(newMemberNumber);
    if (studentNumber.length < 3) {
      setMemberError('Enter the student number used for this class.');
      return;
    }
    setMemberSaving(true);
    setMemberError('');
    try {
      await addInstructorTeamMember({ team, studentNumber, displayName: newMemberName });
      setNewMemberNumber('');
      setNewMemberName('');
      setMemberEditorTeamId('');
    } catch (addError) {
      console.error('Could not add team member:', addError);
      setMemberError(addError instanceof Error ? addError.message : 'The student was not added. Check the details and try again.');
    } finally {
      setMemberSaving(false);
    }
  };

  const removeMemberFromTeam = async (team: CourseTeamWithMembers, studentNumber: string) => {
    setRemovingMemberNumber(studentNumber);
    setMemberError('');
    try {
      await removeInstructorTeamMember({ team, studentNumber });
    } catch (removeError) {
      console.error('Could not remove team member:', removeError);
      setTeamErrorTitle('That student was not removed.');
      setTeamError('Check the connection and try again.');
    } finally {
      setRemovingMemberNumber('');
    }
  };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    const deletedTeamId = teamToDelete.id;
    try {
      await deleteInstructorCourseTeam(teamToDelete);
      if (editingTeamId === deletedTeamId) resetTeamCreator();
      if (memberEditorTeamId === deletedTeamId) setMemberEditorTeamId('');
      setTeamToDelete(null);
    } catch (deleteError) {
      console.error('Could not delete team:', deleteError);
      setTeamToDelete(null);
      setTeamErrorTitle('That team was not deleted.');
      setTeamError('Its roster is still intact. Check the connection and try again.');
    }
  };

  const closeSourceEditor = () => {
    setSourceEditorOpen(false);
    setEditingSourceId('');
    setSourceTitle('');
    setSourceKind('notes');
    setSourceContent('');
    setSourceFileName('');
    setSourceExtractedWithAi(false);
    setSourceError('');
  };

  const openSourceEditor = (source?: CourseSource) => {
    setEditingSourceId(source?.id || '');
    setSourceTitle(source?.title || '');
    setSourceKind(source?.kind || 'notes');
    setSourceContent(source?.content || '');
    setSourceFileName(source?.fileName || '');
    setSourceExtractedWithAi(Boolean(source?.extractedWithAi));
    setSourceError('');
    setSourceEditorOpen(true);
  };

  const handleCourseSourceFile = async (file: File | undefined) => {
    if (!file) return;
    setSourceError('');
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || extension === 'pdf';
    const isText = ['txt', 'md', 'markdown', 'csv', 'tsv'].includes(extension) || file.type.startsWith('text/');
    if (!isPdf && !isText) {
      setSourceError('Export Word or PowerPoint files as PDF, or paste the relevant text below.');
      return;
    }
    setSourceExtracting(true);
    try {
      let content = '';
      let extractedWithAi = false;
      if (isPdf) {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Sign in again before adding this PDF.');
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/extract-course-source', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` }, body: form });
        const data = await response.json() as { content?: string; error?: string; extractedWithAi?: boolean };
        if (!response.ok || !data.content) throw new Error(data.error || 'That PDF could not be prepared.');
        content = data.content;
        extractedWithAi = Boolean(data.extractedWithAi);
      } else {
        if (file.size > 300_000) throw new Error('Choose a text file smaller than 300 KB, or paste the relevant section.');
        content = (await file.text()).trim().slice(0, MAX_COURSE_SOURCE_CHARS);
      }
      if (content.length < 80) throw new Error('That file does not contain enough readable teaching material.');
      setSourceContent(content);
      setSourceFileName(file.name);
      setSourceExtractedWithAi(extractedWithAi);
      if (!sourceTitle.trim()) setSourceTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 100));
      if (extension === 'pdf' || extension === 'md') setSourceKind('reading');
    } catch (fileError) {
      setSourceError(getUserFacingError(fileError, 'That file could not be prepared. Paste the relevant text instead.'));
    } finally {
      setSourceExtracting(false);
      if (sourceFileInputRef.current) sourceFileInputRef.current.value = '';
    }
  };

  const saveCourseSource = async () => {
    if (!course || sourceSaving) return;
    if (sourceTitle.trim().length < 2) {
      setSourceError('Add a short title so you can find this source later.');
      return;
    }
    if (sourceContent.trim().length < 80) {
      setSourceError('Add at least a short section of teaching material.');
      return;
    }
    setSourceSaving(true);
    setSourceError('');
    try {
      const existing = course.courseSources?.find((source) => source.id === editingSourceId);
      const now = new Date().toISOString();
      const source: CourseSource = {
        id: existing?.id || `source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: sourceTitle,
        kind: sourceKind,
        content: sourceContent,
        fileName: sourceFileName || undefined,
        extractedWithAi: sourceExtractedWithAi || undefined,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      const courseSources = upsertCourseSource(course.courseSources || [], source);
      await updateCourse(course.id, { courseSources });
      setCourse((current) => current ? { ...current, courseSources } : current);
      closeSourceEditor();
    } catch (saveError) {
      setSourceError(getUserFacingError(saveError, 'That source was not saved. Your text is still here, so you can try again.'));
    } finally {
      setSourceSaving(false);
    }
  };

  const confirmDeleteSource = async () => {
    if (!course || !sourceToDelete) return;
    const courseSources = removeCourseSource(course.courseSources || [], sourceToDelete.id);
    try {
      await updateCourse(course.id, { courseSources });
      setCourse((current) => current ? { ...current, courseSources } : current);
      setSourceToDelete(null);
    } catch (deleteError) {
      setSourceToDelete(null);
      setError(getUserFacingError(deleteError, 'That source was not removed. Try again.'));
    }
  };

  const updateTemplate = (templateId: string, updates: Partial<SessionInteraction>) => {
    setSaved(false);
    setTemplates((current) => current.map((template) => template.id === templateId ? { ...template, ...updates } : template));
  };

  const updateTemplateOption = (templateId: string, optionIndex: number, value: string) => {
    setTemplates((current) => current.map((template) => {
      if (template.id !== templateId || !template.options) return template;
      const options = [...template.options];
      options[optionIndex] = value;
      return { ...template, options };
    }));
    setSaved(false);
  };

  const removeTemplateOption = (templateId: string, optionIndex: number) => {
    setTemplates((current) => current.map((template) => {
      if (template.id !== templateId || !template.options || template.options.length <= 2) return template;
      const options = template.options.filter((_, index) => index !== optionIndex);
      const correctOptionIndex = template.correctOptionIndex === optionIndex
        ? 0
        : template.correctOptionIndex !== undefined && template.correctOptionIndex > optionIndex
          ? template.correctOptionIndex - 1
          : template.correctOptionIndex;
      return { ...template, options, correctOptionIndex };
    }));
    setSaved(false);
  };

  const saveLibrary = async () => {
    if (!course) return;
    setSaving(true);
    setError('');
    try {
      await updateCourse(course.id, {
        name: className.trim() || course.name,
        term: classTerm.trim() || undefined,
        interactionTemplates: templates,
        teamTags: courseTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
      });
      setCourse((current) => current ? { ...current, name: className.trim() || current.name, term: classTerm.trim() || undefined, interactionTemplates: templates, teamTags: courseTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8) } : current);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (saveError) {
      console.error('Could not save interaction library:', saveError);
      setError('Your interaction library could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const archiveClass = async () => {
    if (!course) return;
    await updateCourse(course.id, { archived: true, archivedAt: Timestamp.now() });
    setCourse((current) => current ? { ...current, archived: true, archivedAt: Timestamp.now() } : current);
    setArchiveOpen(false);
  };

  const restoreClass = async () => {
    if (!course) return;
    setSaving(true);
    try {
      await updateCourse(course.id, { archived: false, archivedAt: null });
      setCourse((current) => current ? { ...current, archived: false, archivedAt: null } : current);
    } catch (restoreError) {
      console.error('Could not restore class:', restoreError);
      setError('The class could not be restored. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openRollover = () => {
    if (!course) return;
    setNextTerm('');
    setNextCode(`${course.code}-${new Date().getFullYear() + 1}`);
    setArchiveAfterRollover(true);
    setRolloverOpen(true);
  };

  const createNextTerm = async () => {
    if (!course || !user || !nextTerm.trim() || !nextCode.trim()) return;
    setRollingOver(true);
    setError('');
    try {
      const existingCourses = await getCoursesByTeacher(user.uid, true);
      const normalizedNextCode = nextCode.trim().toUpperCase();
      if (existingCourses.some((candidate) => candidate.code.trim().toUpperCase() === normalizedNextCode)) {
        setError('That class code is already in use. Choose a different code so records stay separate.');
        setRollingOver(false);
        return;
      }
      const nextCourseId = await createCourse({
        name: course.name,
        code: normalizedNextCode,
        term: nextTerm.trim(),
        teacherId: user.uid,
        studentIds: [],
        interactionTemplates: templates.map((template) => ({ ...template, id: `${template.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })),
        archived: false,
        sourceCourseId: course.id,
      });
      if (archiveAfterRollover) {
        await updateCourse(course.id, { archived: true, archivedAt: Timestamp.now() });
      }
      router.push(`/dashboard/classes/${nextCourseId}`);
    } catch (rolloverError) {
      console.error('Could not create next term:', rolloverError);
      setError('The next term could not be created. Check the details and try again.');
      setRollingOver(false);
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete || sessionToDelete.active) return;
    const deletedSession = sessionToDelete;
    setError('');
    try {
      if (deletedSession.sessionType === 'standalone') {
        await deleteInstructorClassroomData(deletedSession.teacherId, deletedSession.id);
      }
      await deleteSession(deletedSession.id);
      setSessions((current) => current.filter((session) => session.id !== deletedSession.id));
      setSessionToDelete(null);
    } catch (deleteError) {
      console.error('Could not delete session:', deleteError);
      setError('The session could not be deleted. Check your connection and try again.');
      throw deleteError;
    }
  };

  if (loading) {
    return <ProtectedRoute><DashboardLayout><div className="flex min-h-96 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div></DashboardLayout></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <Link href="/dashboard/classes" className="seminar-focus mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] hover:text-[#101a38]"><ArrowLeft className="h-4 w-4" /> All classes</Link>

          {error && !course ? (
            <InlineMessage title="This class is not available here." message={error} />
          ) : course && (
            <>
              <header className="mb-8 flex flex-col gap-5 border-b border-[#e3e5ed] pb-8 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#101a38] px-3 py-1 text-xs font-bold text-white">{course.code}</span>{course.term && <span className="text-xs font-semibold text-[#697087]">{course.term}</span>}{course.archived && <span className="rounded-full bg-[#e7e5df] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5f6472]">Archived</span>}</div>
                  <h1 className="seminar-display mt-4 text-4xl text-[#101a38] sm:text-5xl">{course.name}</h1>
                  <div className="mt-4 flex flex-wrap gap-5 text-sm text-[#697087]"><span className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> {sessions.length} sessions</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> {studentCount} students seen</span><span className="flex items-center gap-2"><Library className="h-4 w-4" /> {templates.length} reusable interactions</span></div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {course.archived ? <Button variant="outline" onClick={restoreClass} loading={saving} className="gap-2"><ArchiveRestore className="h-4 w-4" /> Restore class</Button> : <>
                    <div className="relative" data-overflow-menu>
                      <Button variant="outline" aria-label="More class actions" aria-haspopup="menu" aria-expanded={classMenuOpen} onClick={() => setClassMenuOpen((open) => !open)} className="px-3"><MoreHorizontal className="h-5 w-5" /></Button>
                      {classMenuOpen && <div role="menu" className="absolute right-0 z-30 mt-2 w-56 origin-top-right rounded-2xl border border-[#e3e5ed] bg-white p-1.5 shadow-[0_18px_48px_rgba(16,26,56,0.16)] animate-[fadeIn_180ms_ease-out]">
                        <button type="button" role="menuitem" onClick={() => { setClassMenuOpen(false); openRollover(); }} className="seminar-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[#313950] hover:bg-[#f8f7fb]"><CalendarSync className="h-4 w-4 text-[#697087]" /> Start next term</button>
                        <button type="button" role="menuitem" onClick={() => { setClassMenuOpen(false); setArchiveOpen(true); }} className="seminar-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[#8a4b3d] hover:bg-[#fff1ee]"><Archive className="h-4 w-4" /> Archive class</button>
                      </div>}
                    </div>
                  </>}
                </div>
              </header>

              {error && <InlineMessage className="mb-6" title="That change did not stick yet." message={error} />}

              {course.archived && <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#dedbd2] bg-[#f8f7f3] p-4 text-sm leading-6 text-[#5f6472]"><Archive className="mt-0.5 h-4 w-4 shrink-0" /><span><strong className="block text-[#101a38]">This class is archived.</strong>Its teaching kit and history are read-only until you restore it.</span></div>}

              <nav className="mb-7 flex gap-1 overflow-x-auto rounded-2xl bg-[#f1f0f5] p-1.5" aria-label="Class workspace">
                <button type="button" aria-current={workspaceView === 'sessions' ? 'page' : undefined} onClick={() => setWorkspaceView('sessions')} className={`seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition sm:px-4 ${workspaceView === 'sessions' ? 'bg-white text-[#101a38] shadow-[0_4px_14px_rgba(16,26,56,0.08)]' : 'text-[#697087] hover:text-[#101a38]'}`}><CalendarDays className="h-4 w-4" /> Sessions <span className="hidden rounded-full bg-[#f0efff] px-2 py-0.5 text-[11px] text-[#5146e5] sm:inline">{sessions.length}</span></button>
                <button type="button" aria-current={workspaceView === 'teams' ? 'page' : undefined} onClick={() => setWorkspaceView('teams')} className={`seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition sm:px-4 ${workspaceView === 'teams' ? 'bg-white text-[#101a38] shadow-[0_4px_14px_rgba(16,26,56,0.08)]' : 'text-[#697087] hover:text-[#101a38]'}`}><UsersRound className="h-4 w-4" /> Teams <span className="hidden rounded-full bg-[#f0efff] px-2 py-0.5 text-[11px] text-[#5146e5] sm:inline">{teamRoster.length}</span></button>
                <button type="button" aria-current={workspaceView === 'library' ? 'page' : undefined} onClick={() => setWorkspaceView('library')} className={`seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition sm:px-4 ${workspaceView === 'library' ? 'bg-white text-[#101a38] shadow-[0_4px_14px_rgba(16,26,56,0.08)]' : 'text-[#697087] hover:text-[#101a38]'}`}><Library className="h-4 w-4" /> Interactions <span className="hidden rounded-full bg-[#f0efff] px-2 py-0.5 text-[11px] text-[#5146e5] sm:inline">{templates.length}</span></button>
                <Link href={`/dashboard/progress?courseId=${course.id}`} className="seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-[#697087] transition hover:bg-white hover:text-[#101a38] sm:px-4"><BarChart3 className="h-4 w-4" /> Progress</Link>
              </nav>

              {workspaceView === 'sessions' ? (
                <div>
                  <section className="overflow-visible rounded-3xl border border-[#e3e5ed] bg-white" aria-labelledby="class-sessions-title">
                    <div className="flex flex-col gap-4 border-b border-[#e3e5ed] bg-[linear-gradient(110deg,#fff_0%,#faf9ff_70%,#fff5f0_100%)] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
                      <div><p className="seminar-eyebrow mb-2">Prepare and teach</p><h2 id="class-sessions-title" className="seminar-display text-3xl text-[#101a38]">Plan and run each class</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#697087]">Open a live session when you are teaching, or prepare the interactions for the next one.</p></div>
                      {!course.archived && <Link href={`/dashboard/sessions/new?courseId=${course.id}`}><Button className="gap-2"><Plus className="h-4 w-4" /> New session</Button></Link>}
                    </div>

                    {orderedSessions.length === 0 ? (
                      <div className="px-6 py-14 text-center sm:px-10">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><CalendarPlus className="h-7 w-7" /></span>
                        <h3 className="seminar-display mt-5 text-3xl text-[#101a38]">Plan the first meeting.</h3>
                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#697087]">Give it a title, then add only the polls, quizzes, check-ins, or modules you expect to use.</p>
                        {!course.archived && <Link href={`/dashboard/sessions/new?courseId=${course.id}`} className="mt-6 inline-block"><Button className="gap-2">Plan session 1 <ArrowRight className="h-4 w-4" /></Button></Link>}
                      </div>
                    ) : (
                      <ol className="divide-y divide-[#e8e8ee]">
                        {orderedSessions.map((session, index) => {
                          const sessionNumber = Math.max(1, sessions.length - index);
                          return (
                            <li key={session.id} className="group grid gap-4 p-5 transition-colors hover:bg-[#faf9ff] sm:grid-cols-[54px_minmax(0,1fr)_auto] sm:items-center sm:p-6">
                              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${session.active ? 'bg-[#e8f7ed] text-[#28733a]' : 'bg-[#f0efff] text-[#5146e5]'}`}>{session.active ? <Radio className="h-5 w-5" /> : sessionNumber}</span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em]"><span className={session.active ? 'text-[#28733a]' : 'text-[#5146e5]'}>{session.active ? 'Live now' : `Session ${sessionNumber}`}</span><span className="text-[#9aa0b1]">{readableDate(session.scheduledFor)}</span></div>
                                <h3 className="mt-1 truncate text-lg font-bold text-[#101a38]">{session.title || 'Untitled session'}</h3>
                                <p className="mt-1 flex items-center gap-2 text-xs text-[#697087]"><Library className="h-3.5 w-3.5" /> {session.interactions?.length || 0} activities in this flow</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Link className="flex-1" href={session.active ? `/live?sessionId=${session.id}` : `/dashboard/sessions/${session.id}`}><Button variant={session.active ? 'primary' : 'outline'} className="w-full gap-2 sm:w-auto">{session.active ? <Play className="h-4 w-4" /> : null}{session.active ? 'Open live controls' : 'Open session'} <ArrowRight className="h-4 w-4" /></Button></Link>
                                <div className="relative" data-overflow-menu>
                                  <Button variant="ghost" aria-label={`More actions for ${session.title || 'untitled session'}`} aria-haspopup="menu" aria-expanded={sessionMenuOpen === session.id} onClick={() => setSessionMenuOpen((open) => open === session.id ? null : session.id)} className="px-2.5"><MoreHorizontal className="h-5 w-5" /></Button>
                                  {sessionMenuOpen === session.id && <div role="menu" className="absolute right-0 z-30 mt-2 w-52 origin-top-right rounded-2xl border border-[#e3e5ed] bg-white p-1.5 shadow-[0_18px_48px_rgba(16,26,56,0.16)] animate-[fadeIn_180ms_ease-out]">
                                    {!session.active && <Link role="menuitem" href={`/dashboard/sessions/new?sessionId=${session.id}`} onClick={() => setSessionMenuOpen(null)} className="seminar-focus flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#313950] hover:bg-[#f8f7fb]"><Pencil className="h-4 w-4 text-[#697087]" /> Edit session flow</Link>}
                                    <button type="button" role="menuitem" disabled={session.active} onClick={() => { setSessionMenuOpen(null); setSessionToDelete(session); }} className="seminar-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[#b64936] hover:bg-[#fff1ee] disabled:cursor-not-allowed disabled:text-[#9aa0b1] disabled:hover:bg-transparent"><Trash2 className="h-4 w-4" /> {session.active ? 'End before deleting' : 'Delete session'}</button>
                                  </div>}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>

                </div>
              ) : workspaceView === 'teams' ? (
                <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
                  {teamError && <InlineMessage className="xl:col-span-2" title={teamErrorTitle} message={teamError} />}
                  <section className="overflow-hidden rounded-3xl border border-[#e3e5ed] bg-white" aria-labelledby="course-teams-title">
                    <div className="border-b border-[#e3e5ed] bg-[linear-gradient(115deg,#fff_0%,#f8f6ff_65%,#eef8ff_100%)] p-6 sm:p-7">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="seminar-eyebrow mb-2">Work together</p>
                          <h2 id="course-teams-title" className="seminar-display text-3xl text-[#101a38]">Organize the class into teams</h2>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#697087]">Create teams yourself or let students choose. Their teams stay ready for group work throughout the course.</p>
                        </div>
                        {!course.archived && <Button variant="outline" onClick={() => { if (teamCreatorOpen) resetTeamCreator(); else { setEditingTeamId(''); setNewTeamName(''); setNewTeamDescription(''); setNewTeamTag(''); setNewTeamColor('violet'); setTeamCreatorOpen(true); } setTeamError(''); }} className="shrink-0 gap-2"><Plus className="h-4 w-4" /> {teamCreatorOpen ? 'Close' : 'Create team'}</Button>}
                      </div>
                    </div>
                    {teamCreatorOpen && <div className="border-b border-[#e3e5ed] bg-[#faf9ff] p-5 sm:p-7">
                      <div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow mb-2">{editingTeamId ? 'Team details' : 'New team'}</p><h3 className="seminar-display text-2xl text-[#101a38]">{editingTeamId ? 'Update this team' : 'Add a team before class'}</h3><p className="mt-2 text-sm leading-6 text-[#697087]">{editingTeamId ? 'Changes will appear in the student sign-up list and future team activities.' : 'Students will see it in the sign-up list and can join it by name.'}</p></div><button type="button" onClick={resetTeamCreator} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-white" aria-label="Close team form"><X className="h-5 w-5" /></button></div>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-bold text-[#313950]">Team name<input autoFocus value={newTeamName} onChange={(event) => { setNewTeamName(event.target.value.slice(0, 48)); setTeamError(''); }} maxLength={48} placeholder="For example, Bright Sparks" className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-4 text-base font-normal outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />{duplicateTeam && <small className="font-normal text-[#b64936]">{duplicateTeam.name} is already in this class.</small>}</label>
                        <label className="grid gap-2 text-sm font-bold text-[#313950]">What are they working on? <small className="font-normal text-[#697087]">Optional</small><input value={newTeamDescription} onChange={(event) => setNewTeamDescription(event.target.value.slice(0, 160))} maxLength={160} placeholder="A short note for the class" className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-4 text-base font-normal outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                      </div>
                      {course.teamTags?.length ? <fieldset className="mt-5"><legend className="text-sm font-bold text-[#313950]">Choose a tag <span className="font-normal text-[#697087]">(optional)</span></legend><div className="mt-3 flex flex-wrap gap-2">{course.teamTags.map((teamTag) => <button key={teamTag} type="button" onClick={() => setNewTeamTag((current) => current === teamTag ? '' : teamTag)} aria-pressed={newTeamTag === teamTag} className={`seminar-focus min-h-10 rounded-full border px-3.5 text-sm font-bold transition ${newTeamTag === teamTag ? 'border-[#5146e5] bg-[#f0efff] text-[#5146e5]' : 'border-[#d7dae5] bg-white text-[#555d73] hover:border-[#bdb6ff]'}`}>{teamTag}{newTeamTag === teamTag && <Check className="ml-1.5 inline h-3.5 w-3.5" />}</button>)}</div></fieldset> : null}
                      <fieldset className="mt-5"><legend className="text-sm font-bold text-[#313950]">Pick a team color</legend><div className="mt-3 flex flex-wrap gap-2">{TEAM_COLORS.map((item) => <button key={item.id} type="button" onClick={() => setNewTeamColor(item.id)} aria-label={item.label} aria-pressed={newTeamColor === item.id} className={`seminar-focus grid h-11 w-11 place-items-center rounded-xl border-2 transition ${newTeamColor === item.id ? 'border-[#101a38] bg-white' : 'border-transparent hover:bg-white'}`}><span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: item.value }}>{newTeamColor === item.id && <Check className="h-4 w-4 text-white" />}</span></button>)}</div></fieldset>
                      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={resetTeamCreator}>Cancel</Button><Button onClick={createTeamForClass} loading={creatingTeam} disabled={normalizedNewTeamName.length < 2 || Boolean(duplicateTeam)} className="gap-2">{editingTeamId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingTeamId ? 'Save changes' : 'Add team'}</Button></div>
                    </div>}
                    {teamRoster.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">{teamRoster.map((team) => {
                      const teamColor = TEAM_COLORS.find((item) => item.id === team.color)?.value || '#5146e5';
                      return <article key={team.id} className="rounded-2xl border border-[#e3e5ed] bg-[#fffefa] p-5" style={{ borderTop: `5px solid ${teamColor}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div><h3 className="text-lg font-bold text-[#101a38]">{team.name}</h3>{team.tag && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#555d73]">{team.tag}</span>}</div>
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-[#f0efff] px-2.5 py-1 text-xs font-bold text-[#5146e5]">{team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}</span>
                            {!course.archived && <button type="button" onClick={() => editTeamForClass(team)} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-white hover:text-[#5146e5]" aria-label={`Edit ${team.name}`}><Pencil className="h-4 w-4" /></button>}
                            {!course.archived && <button type="button" onClick={() => setTeamToDelete(team)} className="seminar-focus rounded-lg p-2 text-[#9b6b62] hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${team.name}`}><Trash2 className="h-4 w-4" /></button>}
                          </div>
                        </div>
                        {team.description && <p className="mt-3 text-sm leading-6 text-[#697087]">{team.description}</p>}
                        <div className="mt-4 border-t border-[#e8e8ee] pt-4">
                          <div className="flex items-center justify-between gap-3"><strong className="text-xs uppercase tracking-[0.07em] text-[#697087]">Members</strong>{!course.archived && <button type="button" onClick={() => openMemberEditor(team.id)} className="seminar-focus inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[#5146e5] hover:bg-white"><Plus className="h-3.5 w-3.5" /> {memberEditorTeamId === team.id ? 'Close' : 'Add member'}</button>}</div>
                          {memberEditorTeamId === team.id && <div className="mt-3 grid gap-3 rounded-xl border border-[#dedaf8] bg-[#f7f6ff] p-3 animate-[fadeIn_180ms_ease-out]">
                            <label className="grid gap-1.5 text-xs font-bold text-[#555d73]">Student number<input autoFocus value={newMemberNumber} onChange={(event) => { setNewMemberNumber(normalizeTeamStudentNumber(event.target.value)); setMemberError(''); }} placeholder="For example, 67123456" className="min-h-11 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                            <label className="grid gap-1.5 text-xs font-bold text-[#555d73]">Preferred name <span className="font-normal text-[#697087]">Optional</span><input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value.slice(0, 60))} placeholder="Name shown to the instructor" className="min-h-11 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                            {memberError && <p className="text-xs leading-5 text-[#b64936]" role="alert">{memberError}</p>}
                            <Button size="sm" onClick={() => addMemberToTeam(team)} loading={memberSaving} disabled={newMemberNumber.length < 3} className="w-full gap-2"><Plus className="h-3.5 w-3.5" /> Add to {team.name}</Button>
                          </div>}
                          {team.members.length ? <ul className="mt-3 space-y-1.5">{team.members.map((member) => <li key={member.membershipId} className="flex min-h-10 items-center gap-3 rounded-xl bg-white px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f0efff] text-[11px] font-bold text-[#5146e5]">{(member.displayName || member.studentNumber || 'S').slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#101a38]">{member.displayName || member.studentNumber || 'Student'}</strong>{member.displayName && member.studentNumber && <small className="block truncate text-[11px] text-[#697087]">{member.studentNumber}</small>}</span>{!course.archived && member.studentNumber && <button type="button" disabled={removingMemberNumber === member.studentNumber} onClick={() => removeMemberFromTeam(team, member.studentNumber!)} className="seminar-focus rounded-lg p-2 text-[#9aa0b1] hover:bg-[#fff1ee] hover:text-[#b64936] disabled:opacity-40" aria-label={`Remove ${member.displayName || member.studentNumber} from ${team.name}`}>{removingMemberNumber === member.studentNumber ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}</button>}</li>)}</ul> : <p className="mt-3 text-xs leading-5 text-[#697087]">No students have joined yet.</p>}
                        </div>
                      </article>;
                    })}</div> : !teamCreatorOpen && <div className="px-6 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><UsersRound className="h-7 w-7" /></span><h3 className="seminar-display mt-5 text-3xl text-[#101a38]">Start with the first team.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#697087]">Create it here, or share the sign-up link and let each group add its own.</p><Button variant="outline" onClick={() => { setEditingTeamId(''); setTeamCreatorOpen(true); }} className="mt-6 gap-2"><Plus className="h-4 w-4" /> Create the first team</Button></div>}
                  </section>
                  <aside className="space-y-5 xl:sticky xl:top-6">
                    <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#5146e5]"><Link2 className="h-5 w-5" /></span>
                      <p className="seminar-eyebrow mb-2 mt-5">Let students choose</p><h2 className="seminar-display text-3xl text-[#101a38]">Share team sign-up</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Students can create a team, join one that already exists, or change teams later.</p>
                      <div className="mt-5 grid gap-2"><button type="button" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/teams/${course.id}`); setTeamLinkCopied(true); window.setTimeout(() => setTeamLinkCopied(false), 2200); }} className="seminar-focus flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5146e5] px-4 text-sm font-bold text-white"><Copy className="h-4 w-4" /> {teamLinkCopied ? 'Link copied' : 'Copy sign-up link'}</button><Link href={`/teams/${course.id}`} target="_blank" className="seminar-focus flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-[#5146e5]">Preview student sign-up <ExternalLink className="h-4 w-4" /></Link></div>
                    </section>
                    <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6"><p className="seminar-eyebrow mb-2">Team tags</p><h2 className="seminar-display text-2xl text-[#101a38]">Name the focus</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Use tags for project topics, tracks, or any choice teams should make when they register.</p><div className="mt-4 flex flex-wrap gap-2">{course.teamTags?.length ? course.teamTags.map((teamTag) => <span key={teamTag} className="rounded-full bg-[#f0efff] px-3 py-1.5 text-xs font-bold text-[#5146e5]">{teamTag}</span>) : <span className="text-sm text-[#697087]">Add tags under Class settings in Interactions.</span>}</div></section>
                  </aside>
                </div>
              ) : (
              <fieldset disabled={course.archived} className="m-0 grid min-w-0 items-start gap-8 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7" aria-labelledby="library-title">
                  <div className="flex flex-col gap-4 border-b border-[#e3e5ed] pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl"><p className="seminar-eyebrow mb-2">Reuse what works</p><h2 id="library-title" className="seminar-display text-3xl text-[#101a38]">Build your interaction kit</h2><p className="mt-2 text-sm leading-6 text-[#697087]">Keep the questions and activities you use often. Add a copy to any session, then adjust it for that day.</p></div>
                    <div className="relative shrink-0">
                      <Button variant="outline" onClick={() => setAddOpen((open) => !open)} className="gap-2"><Plus className="h-4 w-4" /> New interaction</Button>
                      {addOpen && <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-[#e3e5ed] bg-white p-2 shadow-[0_18px_50px_rgba(16,26,56,0.14)]">{interactionTypes.map(({ type, label, use: useCase, icon: Icon }) => <button key={type} type="button" onClick={() => { const template = createTemplate(type); const courseTags = courseTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8); setTemplates((current) => [...current, type === 'team-formation' && courseTags.length ? { ...template, teamTags: courseTags } : template]); setAddOpen(false); setSaved(false); }} className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[#f8f7fb]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0efff] text-[#5146e5]"><Icon className="h-4 w-4" /></span><span><strong className="block text-sm text-[#101a38]">{label}</strong><small className="mt-0.5 block leading-5 text-[#697087]">{useCase}</small></span></button>)}</div>}
                    </div>
                  </div>

                  {templates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfd2df] py-12 text-center"><Sparkles className="mx-auto h-7 w-7 text-[#5146e5]" /><h3 className="seminar-display mt-3 text-2xl text-[#101a38]">Build a small, useful kit.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#697087]">Start with an interaction you can imagine using in at least three sessions.</p></div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {templates.map((template) => {
                        const type = interactionTypes.find((option) => option.type === template.type);
                        const Icon = type?.icon || Sparkles;
                        return (
                          <article key={template.id} className="rounded-2xl border border-[#e3e5ed] bg-[#fffefa] p-5">
                            <div className="flex items-start gap-4">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Icon className="h-5 w-5" /></span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <input aria-label="Interaction name" value={template.title} onChange={(event) => updateTemplate(template.id, { title: event.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-[#101a38] outline-none focus:ring-0" />
                                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#697087]">{type?.label || template.type}</span>
                                </div>
                                <textarea aria-label={`${template.title} prompt`} value={template.prompt} onChange={(event) => updateTemplate(template.id, { prompt: event.target.value })} rows={2} className="mt-3 w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />
                                {template.options && <div className="mt-4 space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#697087]">{template.type === 'quiz' || template.type === 'peer-learning' ? 'Choices and correct answer' : 'Response choices'}</p>{template.options.map((option, optionIndex) => { const hasCorrectAnswer = template.type === 'quiz' || template.type === 'peer-learning'; return <div key={`${template.id}-${optionIndex}`} className="flex items-center gap-2"><input type="radio" name={`correct-${template.id}`} checked={hasCorrectAnswer && template.correctOptionIndex === optionIndex} onChange={() => hasCorrectAnswer && updateTemplate(template.id, { correctOptionIndex: optionIndex })} disabled={!hasCorrectAnswer} className={hasCorrectAnswer ? 'accent-[#5146e5]' : 'invisible'} aria-label={hasCorrectAnswer ? `Mark choice ${optionIndex + 1} correct` : undefined} /><input aria-label={`Choice ${optionIndex + 1}`} value={option} onChange={(event) => updateTemplateOption(template.id, optionIndex, event.target.value)} className="min-h-10 flex-1 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /><button type="button" onClick={() => removeTemplateOption(template.id, optionIndex)} disabled={template.options!.length <= 2} className="seminar-focus rounded-lg p-2 text-[#8b91a3] hover:bg-[#fff1ee] hover:text-[#b64936] disabled:opacity-25" aria-label={`Remove choice ${optionIndex + 1}`}><X className="h-3.5 w-3.5" /></button></div>; })}{template.options.length < 6 && <button type="button" onClick={() => updateTemplate(template.id, { options: [...template.options!, `Option ${template.options!.length + 1}`] })} className="seminar-focus ml-6 rounded-lg px-2 py-1 text-xs font-bold text-[#5146e5] hover:bg-white"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add choice</button>}</div>}
                                {(template.type === 'quiz' || template.type === 'peer-learning') && <textarea aria-label={`${template.title} answer explanation`} value={template.explanation || ''} onChange={(event) => updateTemplate(template.id, { explanation: event.target.value })} rows={2} placeholder="Explain why the correct answer is right" className="mt-4 w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />}
                                {template.type === 'peer-learning' && <label className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f6ff] p-3 text-xs font-bold text-[#555d73]"><Repeat2 className="h-4 w-4 text-[#5146e5]" /> Partner discussion <input type="number" aria-label={`${template.title} discussion minutes`} min={1} max={10} value={template.discussionMinutes || 2} onChange={(event) => updateTemplate(template.id, { discussionMinutes: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5" /> min</label>}
                                {template.type === 'group-work' && <label className="mt-4 flex items-center gap-3 rounded-xl bg-[#fff5f0] p-3 text-xs font-bold text-[#654f48]"><UsersRound className="h-4 w-4 text-[#c85540]" /> Suggested size <input type="number" aria-label={`${template.title} group size`} min={2} max={10} value={template.groupSize || 4} onChange={(event) => updateTemplate(template.id, { groupSize: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#e4d7d1] bg-white px-2 py-1.5" /> students</label>}
                                {template.type === 'team-formation' && <label className="mt-4 grid gap-2 rounded-xl bg-[#f7f6ff] p-3 text-xs font-bold text-[#565078]"><span>Course tags <small className="font-normal">Separate with commas</small></span><input defaultValue={(template.teamTags || []).join(', ')} onBlur={(event) => { const teamTags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8); updateTemplate(template.id, { teamTags, requireTeamTag: teamTags.length > 0 }); }} placeholder="Theme 1, Theme 2, Theme 3" className="rounded-lg border border-[#d7dae5] bg-white px-3 py-2 font-normal" /></label>}
                                {template.type === 'spin-wheel' && <div className="mt-4 grid gap-3 rounded-xl border border-[#dedaf8] bg-[#f7f6ff] p-3 text-xs font-bold text-[#565078]"><label className="grid gap-2"><span>Choose from</span><select value={template.wheelSource || 'students'} onChange={(event) => updateTemplate(template.id, { wheelSource: event.target.value as NonNullable<SessionInteraction['wheelSource']> })} className="rounded-lg border border-[#d7dae5] bg-white px-3 py-2 font-normal text-[#313950]"><option value="students">Students who joined</option><option value="teams">Teams created in class</option><option value="custom">A custom list</option></select></label>{template.wheelSource === 'custom' ? <label className="grid gap-2"><span>Items <small className="font-normal">One per line</small></span><textarea value={(template.wheelItems || []).join('\n')} onChange={(event) => updateTemplate(template.id, { wheelItems: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 40) })} rows={5} placeholder={'Topic A\nTopic B\nTopic C'} className="rounded-lg border border-[#d7dae5] bg-white px-3 py-2 font-normal leading-5 text-[#313950]" /></label> : <p className="font-normal leading-5 text-[#697087]">{template.wheelSource === 'teams' ? 'The wheel uses the current team list when you launch it.' : 'The wheel uses the live attendance list. Student display names will appear on the classroom screen.'}</p>}<label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={template.wheelRemoveSelected !== false} onChange={(event) => updateTemplate(template.id, { wheelRemoveSelected: event.target.checked })} className="accent-[#5146e5]" /> Remove each selection before the next spin</label></div>}
                                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 text-xs text-[#697087]">
                                  {(template.type === 'timer' || template.type === 'group-work') && (
                                    <label className="grid gap-1.5 font-semibold">
                                      <span>{template.type === 'group-work' ? 'Work time' : 'Duration'}</span>
                                      <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /><input type="number" aria-label={`${template.title} ${template.type === 'group-work' ? 'work time' : 'duration'} minutes`} min={1} max={60} value={template.durationMinutes || 3} onChange={(event) => updateTemplate(template.id, { durationMinutes: Number(event.target.value) })} className="w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5" /> min</span>
                                    </label>
                                  )}
                                  <div className="ml-auto flex gap-1"><button type="button" onClick={() => { setTemplates((current) => [...current, { ...template, id: `${template.id}-copy-${Date.now()}`, title: `${template.title} copy` }]); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-white" aria-label={`Duplicate ${template.title}`}><Copy className="h-4 w-4" /></button><button type="button" onClick={() => { setTemplates((current) => current.filter((item) => item.id !== template.id)); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${template.title}`}><Trash2 className="h-4 w-4" /></button></div>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e3e5ed] pt-6"><span className={`flex items-center gap-1.5 text-sm font-semibold text-[#3a8b50] transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} role="status"><Check className="h-4 w-4" /> Saved</span><Button onClick={saveLibrary} loading={saving} className="gap-2"><Save className="h-4 w-4" /> Save changes</Button></div>
                </section>

                <aside className="space-y-5 xl:sticky xl:top-6">
                  <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6" aria-labelledby="course-sources-title">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="seminar-eyebrow mb-2">Private teaching context</p><h2 id="course-sources-title" className="seminar-display text-2xl text-[#101a38]">Course sources</h2></div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#5146e5]">{course.courseSources?.length || 0}/{MAX_COURSE_SOURCES}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#697087]">Save the material you return to when planning questions. Students cannot see it.</p>
                    {course.courseSources?.length ? <ul className="mt-5 space-y-2">{course.courseSources.map((source) => <li key={source.id} className="rounded-xl border border-[#dedaf8] bg-white p-3">
                      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f0efff] text-[#5146e5]"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{source.title}</strong><small className="mt-0.5 block text-[#697087]">{COURSE_SOURCE_KINDS.find((kind) => kind.value === source.kind)?.label || 'Course source'} · {courseSourceWordCount(source.content).toLocaleString()} words</small></span><button type="button" onClick={() => openSourceEditor(source)} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f7f6ff] hover:text-[#5146e5]" aria-label={`Edit ${source.title}`}><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setSourceToDelete(source)} className="seminar-focus rounded-lg p-2 text-[#9b6b62] hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${source.title}`}><Trash2 className="h-3.5 w-3.5" /></button></div>
                    </li>)}</ul> : <div className="mt-5 rounded-xl border border-dashed border-[#cfcaf3] bg-white/65 p-4 text-sm leading-6 text-[#697087]">Add a syllabus, reading, slide export, case, or teaching note.</div>}
                    {!course.archived && <Button variant="outline" onClick={() => openSourceEditor()} disabled={(course.courseSources?.length || 0) >= MAX_COURSE_SOURCES} className="mt-5 w-full gap-2"><Plus className="h-4 w-4" /> Add course source</Button>}
                  </section>
                  <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6">
                    <p className="seminar-eyebrow mb-2">Class settings</p><h2 className="seminar-display text-2xl text-[#101a38]">Details used across the course</h2>
                    <label className="mt-5 grid gap-1.5 text-xs font-bold text-[#697087]">Class name<input value={className} onChange={(event) => { setClassName(event.target.value); setSaved(false); }} className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#697087]">Term<input value={classTerm} onChange={(event) => { setClassTerm(event.target.value); setSaved(false); }} placeholder="Fall 2026" className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#697087]">Team tags <small className="font-normal">Separate with commas</small><input value={courseTagsInput} onChange={(event) => { setCourseTagsInput(event.target.value); setSaved(false); }} placeholder="Case topic, Track, Theme" className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <p className="mt-3 text-xs leading-5 text-[#697087]">The class code stays fixed so older attendance and session records remain connected.</p>
                  </section>
                </aside>
              </fieldset>
              )}

              <Dialog isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} onConfirm={archiveClass} title="Archive this class?" message="It will move out of your current classes. Sessions, attendance, student progress, and reusable interactions will be kept." confirmText="Archive class" variant="destructive" />

              <Dialog isOpen={Boolean(sessionToDelete)} onClose={() => setSessionToDelete(null)} onConfirm={confirmDeleteSession} title="Delete this session?" message={`“${sessionToDelete?.title || 'Untitled session'}” and its live classroom data will be permanently deleted. This cannot be undone.`} confirmText="Delete session" variant="destructive" />

              <Dialog isOpen={Boolean(teamToDelete)} onClose={() => setTeamToDelete(null)} onConfirm={confirmDeleteTeam} title={`Delete ${teamToDelete?.name || 'this team'}?`} message={`${teamToDelete?.memberCount || 0} ${teamToDelete?.memberCount === 1 ? 'student is' : 'students are'} currently assigned to this team. Deleting it removes those assignments, but keeps the students and their course records.`} confirmText="Delete team" variant="destructive" />

              <Dialog isOpen={Boolean(sourceToDelete)} onClose={() => setSourceToDelete(null)} onConfirm={confirmDeleteSource} title={`Delete ${sourceToDelete?.title || 'this source'}?`} message="It will no longer be available when planning sessions. Existing questions and session records will stay intact." confirmText="Delete source" variant="destructive" />

              {sourceEditorOpen && (
                <div className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-[#101a38]/55 p-4" role="presentation">
                  <section className="my-6 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,26,56,0.25)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="source-editor-title">
                    <div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow mb-2">Private course source</p><h2 id="source-editor-title" className="seminar-display text-3xl text-[#101a38]">{editingSourceId ? 'Update this source' : 'Add teaching material'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#697087]">Save only the material Classfully should use when helping you prepare interactions.</p></div><button type="button" onClick={closeSourceEditor} disabled={sourceSaving || sourceExtracting} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb] disabled:opacity-40" aria-label="Close source editor"><X className="h-5 w-5" /></button></div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
                      <label className="grid gap-2 text-sm font-bold text-[#313950]">Source title<input autoFocus value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value.slice(0, 100)); setSourceError(''); }} placeholder="For example, Week 4 platform reading" className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-4 text-base font-normal outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                      <label className="grid gap-2 text-sm font-bold text-[#313950]">Type<select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as CourseSourceKind)} className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]">{COURSE_SOURCE_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
                    </div>

                    <input ref={sourceFileInputRef} type="file" accept=".pdf,.txt,.md,.markdown,.csv,.tsv,application/pdf,text/plain,text/markdown,text/csv,text/tab-separated-values" className="hidden" onChange={(event) => handleCourseSourceFile(event.target.files?.[0])} />
                    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#dedaf8] bg-[#f7f6ff] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#5146e5]"><Upload className="h-4 w-4" /></span><span><strong className="block text-sm text-[#101a38]">Upload PDF or text</strong><small className="mt-1 block leading-5 text-[#697087]">For Word or PowerPoint, export a PDF first. You can also paste below.</small>{sourceFileName && <small className="mt-1 block font-bold text-[#5146e5]">{sourceFileName}</small>}</span></div><Button type="button" variant="outline" onClick={() => sourceFileInputRef.current?.click()} loading={sourceExtracting} disabled={sourceSaving} className="shrink-0">Choose file</Button></div>

                    <label className="mt-5 grid gap-2 text-sm font-bold text-[#313950]">Teaching material<textarea value={sourceContent} onChange={(event) => { setSourceContent(event.target.value.slice(0, MAX_COURSE_SOURCE_CHARS)); setSourceFileName(''); setSourceExtractedWithAi(false); setSourceError(''); }} rows={11} maxLength={MAX_COURSE_SOURCE_CHARS} placeholder="Paste the part of the course material you want available when planning sessions." className="w-full resize-y rounded-xl border border-[#d7dae5] bg-white px-4 py-3 text-sm font-normal leading-6 outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /><span className="flex justify-between text-xs font-normal text-[#697087]"><span>{courseSourceWordCount(sourceContent).toLocaleString()} words</span><span>{sourceContent.length.toLocaleString()} / {MAX_COURSE_SOURCE_CHARS.toLocaleString()}</span></span></label>

                    <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#e3e5ed] bg-[#faf9fc] p-3 text-xs leading-5 text-[#555d73]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3a8b50]" /><span>Do not add student names, numbers, grades, health information, or private submissions. PDFs are sent to the configured AI service to extract text. The original file is not stored.</span></div>
                    {sourceError && <InlineMessage className="mt-4" title="Check this source" message={sourceError} />}
                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={closeSourceEditor} disabled={sourceSaving || sourceExtracting}>Cancel</Button><Button onClick={saveCourseSource} loading={sourceSaving} disabled={sourceExtracting || sourceTitle.trim().length < 2 || sourceContent.trim().length < 80} className="gap-2"><Save className="h-4 w-4" /> {editingSourceId ? 'Save source changes' : 'Save course source'}</Button></div>
                  </section>
                </div>
              )}

              {rolloverOpen && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-[#101a38]/55 p-4" role="presentation">
                  <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,26,56,0.25)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="rollover-title">
                    <div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow mb-2">New teaching period</p><h2 id="rollover-title" className="seminar-display text-3xl text-[#101a38]">Start the next term</h2></div><button type="button" onClick={() => setRolloverOpen(false)} disabled={rollingOver} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb]" aria-label="Close"><X className="h-5 w-5" /></button></div>
                    <p className="mt-3 text-sm leading-6 text-[#697087]">Your interaction library will be copied. Students, attendance, responses, and sessions will start fresh.</p>
                    <label className="mt-6 grid gap-1.5 text-xs font-bold text-[#697087]">New term<input value={nextTerm} onChange={(event) => setNextTerm(event.target.value)} placeholder="Spring 2027" className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#697087]">New class code<input value={nextCode} onChange={(event) => setNextCode(event.target.value)} className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm uppercase text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /><span className="font-normal leading-5">Use a new code so student and session records never mix across terms.</span></label>
                    <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#3f465b]"><input type="checkbox" checked={archiveAfterRollover} onChange={(event) => setArchiveAfterRollover(event.target.checked)} className="mt-1 accent-[#5146e5]" /><span><strong className="block text-[#101a38]">Archive the current class</strong>Keep its history available under Archived classes.</span></label>
                    <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setRolloverOpen(false)} disabled={rollingOver}>Cancel</Button><Button onClick={createNextTerm} loading={rollingOver} disabled={!nextTerm.trim() || !nextCode.trim()} className="gap-2"><CalendarSync className="h-4 w-4" /> Create next term</Button></div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
