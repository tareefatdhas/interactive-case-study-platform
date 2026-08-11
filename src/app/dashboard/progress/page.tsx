'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getAllStudentsWithStats,
  getCoursesByTeacher,
  getSessionsByTeacher,
  syncStandaloneSessionStudents,
} from '@/lib/firebase/firestore';
import {
  getInstructorClassroomRecords,
  type InstructorClassroomRecords,
  type StoredLiveResponse,
} from '@/lib/firebase/live-classroom';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import StudentResponseModal from '@/components/teacher/StudentResponseModal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import InlineMessage from '@/components/ui/InlineMessage';
import { AmbientLoading } from '@/components/motion';
import { countPlayedParticipationOpportunities, selectDefaultProgressCourseId } from '@/lib/student-progress-metrics';
import type { Course, Session, SessionInteraction, Student } from '@/types';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BookOpenCheck,
  CalendarCheck,
  Check,
  ChevronRight,
  Download,
  Eye,
  Filter,
  HeartPulse,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

interface StudentWithStats extends Student {
  stats: {
    totalResponses: number;
    correctResponses: number;
    correctPercentage: number;
    totalPoints: number;
    maxTotalPoints: number;
    averageScore: number;
    progressPercentage: number;
    totalQuestionsAvailable: number;
  };
}

type StudentSessionState = 'responded' | 'attended' | 'missed';
type SmartFilter = 'all' | 'check-in' | 'attendance' | 'quiet' | 'pulse' | 'momentum';
type SortField = 'name' | 'attendance' | 'participation' | 'quiz';
type SortDirection = 'asc' | 'desc';

type LiveStudentMetrics = {
  responses: number;
  responseOpportunities: number;
  participationRate: number | null;
  quizAnswered: number;
  quizCorrect: number;
  quizPercentage: number | null;
  latestPulseLabel: string | null;
  pulseNeedsCheckIn: boolean;
  pulseTrend: PulseTrend;
  sessionStates: Array<{ session: Session; state: StudentSessionState }>;
  noRecentResponse: boolean;
};

type PulsePoint = {
  label: string;
  score: number | null;
  concern: boolean;
  severe: boolean;
  submittedAt: number;
};

type PulseTrend = {
  points: PulsePoint[];
  label: string;
  tone: 'positive' | 'steady' | 'mixed' | 'watch' | 'empty';
};

type StudentProgressRow = StudentWithStats & {
  attended: number;
  attendance: number;
  lastSeen?: Session;
  liveMetrics: LiveStudentMetrics;
  needsCheckIn: boolean;
  momentum: boolean;
};

type SessionSignal = {
  session: Session;
  attendance: number;
  participation: number | null;
  pulseReady: number | null;
};

const CONCERN_PULSE_PATTERN = /overwhelm|tired|confus|lost|struggl|not ready|need\s+(a\s+)?(pause|help|time)|too fast|anxious|stress|unprepared|low confidence/i;
const SEVERE_PULSE_PATTERN = /overwhelm|lost|confus|struggl|not okay|need\s+(a\s+)?help|anxious|stress/i;
const POSITIVE_PULSE_PATTERN = /energ|excited|great|ready|very confident|could teach|excellent|strong/i;
const STEADY_PULSE_PATTERN = /steady|okay|mostly got|good|calm|comfortable/i;
const WATCH_PULSE_PATTERN = /tired|getting there|unsure|need\s+(more\s+)?time|not ready|low confidence|too fast/i;
const PRIVATE_PULSE_PATTERN = /prefer not|private|skip/i;

const hasStudent = (session: Session, student: StudentWithStats) => (
  session.studentsJoined?.includes(student.id) || session.studentsJoined?.includes(student.studentId)
);

const normalizeStudentNumber = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const sessionDate = (session: Session) => session.startedAt?.toDate?.() || session.endedAt?.toDate?.() || session.createdAt?.toDate?.() || new Date(0);
const sessionTitle = (session: Session) => session.title || session.caseStudyTitle || 'Class session';
const shortSessionTitle = (session: Session) => sessionTitle(session).replace(/^Session\s+/i, 'S');

function responseInteraction(session: Session, response: StoredLiveResponse) {
  return session.interactions?.find((interaction) => interaction.id === response.interactionId);
}

function isPulseConcern(interaction: SessionInteraction | undefined, response: StoredLiveResponse) {
  if (interaction?.type !== 'pulse' || typeof response.optionIndex !== 'number') return false;
  return CONCERN_PULSE_PATTERN.test(interaction.options?.[response.optionIndex] || '');
}

function pulseScore(label: string) {
  if (PRIVATE_PULSE_PATTERN.test(label)) return null;
  if (SEVERE_PULSE_PATTERN.test(label)) return 1;
  if (WATCH_PULSE_PATTERN.test(label)) return 2;
  if (STEADY_PULSE_PATTERN.test(label)) return 3;
  if (POSITIVE_PULSE_PATTERN.test(label)) return 4;
  return 3;
}

function describePulseTrend(points: PulsePoint[]): PulseTrend {
  const recent = [...points].sort((a, b) => a.submittedAt - b.submittedAt).slice(-5);
  const scored = recent.filter((point): point is PulsePoint & { score: number } => point.score !== null);
  if (!recent.length) return { points: [], label: 'No pulse yet', tone: 'empty' };
  if (!scored.length) return { points: recent, label: 'Private', tone: 'steady' };

  const latest = scored.at(-1)!;
  const lastThree = scored.slice(-3);
  const lastTwo = scored.slice(-2);
  if (latest.severe || (lastTwo.length === 2 && lastTwo.every((point) => point.concern))) {
    return { points: recent, label: lastTwo.length === 2 ? 'Needs support' : 'Follow up', tone: 'watch' };
  }
  if (scored.length === 1) {
    if (latest.score === 4) return { points: recent, label: 'Energized', tone: 'positive' };
    if (latest.score === 3) return { points: recent, label: 'Steady', tone: 'steady' };
    return { points: recent, label: 'Early signal', tone: 'mixed' };
  }
  if (lastThree.length >= 2 && lastThree.every((point) => point.score === 4)) {
    return { points: recent, label: 'Consistently energized', tone: 'positive' };
  }
  if (scored.length >= 3) {
    const prior = scored.slice(-4, -2);
    const current = scored.slice(-2);
    const priorAverage = prior.reduce((sum, point) => sum + point.score, 0) / prior.length;
    const currentAverage = current.reduce((sum, point) => sum + point.score, 0) / current.length;
    if (currentAverage - priorAverage >= 0.75) return { points: recent, label: 'Improving', tone: 'positive' };
    if (priorAverage - currentAverage >= 0.75) return { points: recent, label: 'Trending down', tone: 'watch' };
  }
  if (lastThree.length >= 2 && lastThree.every((point) => point.score >= 3)) {
    return { points: recent, label: 'Steady', tone: 'steady' };
  }
  if (latest.score >= 3 && scored.some((point) => point.concern)) {
    return { points: recent, label: 'Feeling better', tone: 'positive' };
  }
  return { points: recent, label: 'Mixed', tone: 'mixed' };
}

function signalPath(values: Array<number | null>, width = 560, height = 72) {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length < 2) return '';
  return values.map((value, index) => {
    if (value === null) return null;
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
    return `${x},${y}`;
  }).filter(Boolean).join(' ');
}

function PulseTrendCell({ trend, latestLabel }: { trend: PulseTrend; latestLabel: string | null }) {
  if (!trend.points.length) return <span className="text-xs text-[#9298a8]">No pulse yet</span>;

  const plottedValues = trend.points.map((point) => point.score === null ? null : point.score * 25);
  const path = signalPath(plottedValues, 88, 24);
  const lineColor = trend.tone === 'watch' ? '#c45d45' : trend.tone === 'positive' ? '#36a35b' : '#7067e8';
  const badgeStyle = trend.tone === 'watch'
    ? 'bg-[#fff0eb] text-[#ad4d39]'
    : trend.tone === 'positive'
      ? 'bg-[#edf8f0] text-[#26743c]'
      : trend.tone === 'mixed'
        ? 'bg-[#fff6d9] text-[#8d6200]'
        : 'bg-[#f0efff] text-[#5146e5]';

  return (
    <div className="flex items-center gap-3">
      <svg className="h-8 w-[88px] shrink-0 overflow-visible" viewBox="0 0 88 26" role="img" aria-label={`${trend.label}. Latest response: ${latestLabel || 'not recorded'}`}>
        <line x1="0" y1="13" x2="88" y2="13" stroke="#e3e5ed" strokeWidth="1" />
        {path && <polyline points={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {trend.points.map((point, index, points) => point.score === null ? null : (
          <circle
            key={`${point.submittedAt}-${index}`}
            cx={points.length === 1 ? 44 : (index / (points.length - 1)) * 88}
            cy={24 - (point.score / 4) * 24}
            r="3.2"
            fill={point.severe ? '#c45d45' : point.score === 2 ? '#e2a51a' : point.score === 4 ? '#36a35b' : '#7067e8'}
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="min-w-0">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeStyle}`}>{trend.label}</span>
        <span className="mt-1 block max-w-32 truncate text-xs text-[#697087]" title={latestLabel || ''}>{latestLabel}</span>
      </div>
    </div>
  );
}

function ProgressContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedCourseId = searchParams.get('courseId');
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [liveRecords, setLiveRecords] = useState<Record<string, InstructorClassroomRecords>>({});
  const [selectedCourseId, setSelectedCourseId] = useState(requestedCourseId || '');
  const [search, setSearch] = useState('');
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProgress = async () => {
      if (!user) return;
      try {
        const [courseData, sessionData, studentData] = await Promise.all([
          getCoursesByTeacher(user.uid),
          getSessionsByTeacher(user.uid),
          getAllStudentsWithStats(user.uid),
        ]);
        const classroomRecordPairs = await Promise.all(sessionData
          .filter((session) => session.sessionType === 'standalone')
          .map(async (session) => {
            try {
              return [session.id, await getInstructorClassroomRecords(user.uid, session.id)] as const;
            } catch {
              return [session.id, {
                attendance: {},
                responses: {},
                studentQuestions: {},
                questionVotes: {},
                dismissedQuestions: {},
                recognizedQuestions: {},
              } satisfies InstructorClassroomRecords] as const;
            }
          }));
        const records: Record<string, InstructorClassroomRecords> = Object.fromEntries(classroomRecordPairs);
        await Promise.allSettled(sessionData
          .filter((session) => session.sessionType === 'standalone')
          .map((session) => syncStandaloneSessionStudents(
            session.id,
            user.uid,
            Object.values(records[session.id]?.attendance || {}).map((claim) => claim.studentNumber),
          )));

        const knownStudents = Array.from((studentData as StudentWithStats[]).reduce((byStudentNumber, student) => {
          const normalized = normalizeStudentNumber(student.studentIdNormalized || student.studentId || student.id);
          const existing = byStudentNumber.get(normalized);
          if (!existing || student.stats.totalResponses > existing.stats.totalResponses) byStudentNumber.set(normalized, student);
          return byStudentNumber;
        }, new Map<string, StudentWithStats>()).values());
        const knownNumbers = new Set(knownStudents.map((student) => normalizeStudentNumber(student.studentId)));
        const attendanceOnlyStudents: StudentWithStats[] = [];

        Object.values(records).forEach((record) => Object.values(record.attendance).forEach((claim) => {
          const normalized = normalizeStudentNumber(claim.studentNumber);
          if (!normalized || knownNumbers.has(normalized)) return;
          knownNumbers.add(normalized);
          attendanceOnlyStudents.push({
            id: `attendance-${normalized}`,
            studentId: claim.studentNumber,
            studentIdNormalized: normalized,
            name: claim.studentDisplayName || `Student ${claim.studentNumber.slice(-4)}`,
            courseIds: [],
            createdAt: sessionData[0]?.createdAt || Timestamp.now(),
            stats: { totalResponses: 0, correctResponses: 0, correctPercentage: 0, totalPoints: 0, maxTotalPoints: 0, averageScore: 0, progressPercentage: 0, totalQuestionsAvailable: 0 },
          });
        }));

        sessionData.filter((session) => session.sessionType === 'standalone').forEach((session) => {
          (session.studentsJoined || []).forEach((studentNumber) => {
            const normalized = normalizeStudentNumber(studentNumber);
            if (!normalized || knownNumbers.has(normalized)) return;
            knownNumbers.add(normalized);
            attendanceOnlyStudents.push({
              id: `attendance-${normalized}`,
              studentId: studentNumber,
              studentIdNormalized: normalized,
              name: `Student •${studentNumber.slice(-4)}`,
              courseIds: session.courseId ? [session.courseId] : [],
              createdAt: session.createdAt || Timestamp.now(),
              stats: { totalResponses: 0, correctResponses: 0, correctPercentage: 0, totalPoints: 0, maxTotalPoints: 0, averageScore: 0, progressPercentage: 0, totalQuestionsAvailable: 0 },
            });
          });
        });

        const activeCourses = courseData.filter((course) => !course.archived);
        setCourses(activeCourses);
        setSessions(sessionData);
        setLiveRecords(records);
        setStudents([...knownStudents, ...attendanceOnlyStudents]);
        setSelectedCourseId(selectDefaultProgressCourseId(activeCourses, sessionData, requestedCourseId));
      } catch (loadError) {
        console.error('Could not load student progress:', loadError);
        setError('Student progress could not be loaded. Try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, [requestedCourseId, user]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const relevantSessions = useMemo(() => sessions.filter((session) => (
    selectedCourseId === 'all'
      ? true
      : session.courseId === selectedCourseId || (!session.courseId && session.courseCode === selectedCourse?.code)
  )), [selectedCourse?.code, selectedCourseId, sessions]);

  const heldSessions = useMemo(() => relevantSessions.filter((session) => (
    session.active || session.startedAt || session.endedAt || (session.studentsJoined?.length || 0) > 0
  )).sort((a, b) => sessionDate(a).getTime() - sessionDate(b).getTime()), [relevantSessions]);

  const attendedSession = useCallback((session: Session, student: StudentWithStats) => {
    if (hasStudent(session, student)) return true;
    const target = normalizeStudentNumber(student.studentId);
    return Object.values(liveRecords[session.id]?.attendance || {}).some((claim) => normalizeStudentNumber(claim.studentNumber) === target);
  }, [liveRecords]);

  const studentMetrics = useCallback((student: StudentWithStats, scopedSessions: Session[]): LiveStudentMetrics => {
    const target = normalizeStudentNumber(student.studentId);
    let responses = 0;
    let responseOpportunities = 0;
    let quizAnswered = 0;
    let quizCorrect = 0;
    const studentPulseResponses: PulsePoint[] = [];

    const sessionStates = scopedSessions.map((session) => {
      const records = liveRecords[session.id];
      const studentUid = Object.entries(records?.attendance || {}).find(([, claim]) => normalizeStudentNumber(claim.studentNumber) === target)?.[0];
      const sessionResponses = studentUid
        ? Object.values(records?.responses || {}).map((runResponses) => runResponses[studentUid]).filter(Boolean)
        : [];
      const attended = attendedSession(session, student);
      const attendanceClaim = studentUid ? records?.attendance?.[studentUid] : undefined;
      if (attended) {
        responseOpportunities += countPlayedParticipationOpportunities({
          runs: session.interactionRuns,
          interactions: session.interactions,
          responseRuns: records?.responses,
          studentUid,
          joinedAt: attendanceClaim?.joinedAt,
        });
      }

      sessionResponses.forEach((response) => {
        const interaction = responseInteraction(session, response);
        const countsTowardParticipation = !interaction
          || (interaction.type !== 'timer' && interaction.type !== 'spin-wheel' && interaction.type !== 'group-work');
        if (countsTowardParticipation) responses += 1;
        if ((interaction?.type === 'quiz' || interaction?.type === 'peer-learning') && typeof response.optionIndex === 'number') {
          quizAnswered += 1;
          if (response.optionIndex === interaction.correctOptionIndex) quizCorrect += 1;
        }
        if (interaction?.type === 'pulse' && typeof response.optionIndex === 'number') {
          const label = interaction.options?.[response.optionIndex] || 'Pulse recorded';
          studentPulseResponses.push({
            label,
            score: pulseScore(label),
            concern: isPulseConcern(interaction, response),
            severe: SEVERE_PULSE_PATTERN.test(label),
            submittedAt: response.submittedAt,
          });
        }
      });

      if (sessionResponses.length > 0) return { session, state: 'responded' as const };
      if (attended) return { session, state: 'attended' as const };
      return { session, state: 'missed' as const };
    });
    const recentStates = sessionStates.slice(-2);
    const noRecentResponse = recentStates.length > 0
      && recentStates.some(({ state }) => state !== 'missed')
      && recentStates.every(({ state }) => state !== 'responded');
    const pulseTrend = describePulseTrend(studentPulseResponses);
    const latestPulse = [...studentPulseResponses].sort((a, b) => b.submittedAt - a.submittedAt)[0];

    return {
      responses,
      responseOpportunities,
      participationRate: responseOpportunities ? Math.min(100, Math.round((responses / responseOpportunities) * 100)) : null,
      quizAnswered,
      quizCorrect,
      quizPercentage: quizAnswered ? Math.round((quizCorrect / quizAnswered) * 100) : null,
      latestPulseLabel: latestPulse ? latestPulse.label : null,
      pulseNeedsCheckIn: pulseTrend.tone === 'watch',
      pulseTrend,
      sessionStates,
      noRecentResponse,
    };
  }, [attendedSession, liveRecords]);

  const scopedRows = useMemo<StudentProgressRow[]>(() => {
    const inScope = selectedCourseId === 'all'
      ? students
      : students.filter((student) => heldSessions.some((session) => attendedSession(session, student)));
    return inScope.map((student) => {
      const attendedSessions = heldSessions.filter((session) => attendedSession(session, student));
      const attended = attendedSessions.length;
      const attendance = heldSessions.length ? Math.round((attended / heldSessions.length) * 100) : 0;
      const liveMetrics = studentMetrics(student, heldSessions);
      const needsCheckIn = heldSessions.length >= 2 && (
        attendance < 60
        || liveMetrics.noRecentResponse
        || liveMetrics.pulseNeedsCheckIn
        || (liveMetrics.quizAnswered >= 2 && (liveMetrics.quizPercentage || 0) < 60)
      );
      const momentum = heldSessions.length >= 2
        && attendance >= 75
        && (liveMetrics.participationRate === null || liveMetrics.participationRate >= 70)
        && (liveMetrics.quizPercentage === null || liveMetrics.quizPercentage >= 70)
        && !liveMetrics.pulseNeedsCheckIn;
      return {
        ...student,
        attended,
        attendance,
        lastSeen: attendedSessions.at(-1),
        liveMetrics,
        needsCheckIn,
        momentum,
      };
    });
  }, [attendedSession, heldSessions, selectedCourseId, studentMetrics, students]);

  const filterCounts = useMemo<Record<SmartFilter, number>>(() => ({
    all: scopedRows.length,
    'check-in': scopedRows.filter((student) => student.needsCheckIn).length,
    attendance: scopedRows.filter((student) => heldSessions.length >= 2 && student.attendance < 75).length,
    quiet: scopedRows.filter((student) => student.liveMetrics.noRecentResponse).length,
    pulse: scopedRows.filter((student) => student.liveMetrics.pulseNeedsCheckIn).length,
    momentum: scopedRows.filter((student) => student.momentum).length,
  }), [heldSessions.length, scopedRows]);

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = scopedRows.filter((student) => {
      if (query && !student.name?.toLowerCase().includes(query) && !student.studentId.toLowerCase().includes(query)) return false;
      if (smartFilter === 'check-in') return student.needsCheckIn;
      if (smartFilter === 'attendance') return heldSessions.length >= 2 && student.attendance < 75;
      if (smartFilter === 'quiet') return student.liveMetrics.noRecentResponse;
      if (smartFilter === 'pulse') return student.liveMetrics.pulseNeedsCheckIn;
      if (smartFilter === 'momentum') return student.momentum;
      return true;
    });
    return filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'attendance') return (a.attendance - b.attendance) * direction;
      if (sortField === 'participation') return ((a.liveMetrics.participationRate ?? -1) - (b.liveMetrics.participationRate ?? -1)) * direction;
      if (sortField === 'quiz') return ((a.liveMetrics.quizPercentage ?? -1) - (b.liveMetrics.quizPercentage ?? -1)) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [heldSessions.length, scopedRows, search, smartFilter, sortDirection, sortField]);

  const averageAttendance = scopedRows.length
    ? Math.round(scopedRows.reduce((sum, student) => sum + student.attendance, 0) / scopedRows.length)
    : 0;
  const averageParticipation = (() => {
    const recorded = scopedRows.map((student) => student.liveMetrics.participationRate).filter((value): value is number => value !== null);
    return recorded.length ? Math.round(recorded.reduce((sum, value) => sum + value, 0) / recorded.length) : null;
  })();
  const activeParticipants = scopedRows.filter((student) => student.momentum).length;

  const sessionSignals = useMemo<SessionSignal[]>(() => heldSessions.slice(-8).map((session) => {
    const record = liveRecords[session.id];
    const attendanceClaims = Object.values(record?.attendance || {});
    const joined = new Set([
      ...(session.studentsJoined || []).map(normalizeStudentNumber),
      ...attendanceClaims.map((claim) => normalizeStudentNumber(claim.studentNumber)),
    ].filter(Boolean));
    const respondents = new Set<string>();
    const pulseResponses: Array<{ interaction: SessionInteraction; response: StoredLiveResponse }> = [];
    Object.values(record?.responses || {}).forEach((runResponses) => Object.values(runResponses || {}).forEach((response) => {
      respondents.add(response.studentUid);
      const interaction = responseInteraction(session, response);
      if (interaction?.type === 'pulse') pulseResponses.push({ interaction, response });
    }));
    const pulseReady = pulseResponses.length
      ? Math.round((pulseResponses.filter(({ interaction, response }) => !isPulseConcern(interaction, response)).length / pulseResponses.length) * 100)
      : null;
    return {
      session,
      attendance: scopedRows.length ? Math.min(100, Math.round((joined.size / scopedRows.length) * 100)) : 0,
      participation: joined.size ? Math.min(100, Math.round((respondents.size / joined.size) * 100)) : null,
      pulseReady,
    };
  }), [heldSessions, liveRecords, scopedRows.length]);

  const updateSort = (field: SortField) => {
    if (sortField === field) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const selectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSmartFilter('all');
    setSearch('');
  };

  const exportProgress = () => {
    const rows = visibleStudents.map((student) => [
      student.name,
      student.studentId,
      `${student.attended}/${heldSessions.length}`,
      `${student.attendance}%`,
      student.liveMetrics.participationRate === null ? 'Not recorded' : `${student.liveMetrics.participationRate}%`,
      student.liveMetrics.quizPercentage === null ? 'Not recorded' : `${student.liveMetrics.quizPercentage}%`,
      student.liveMetrics.pulseTrend.label,
      student.liveMetrics.latestPulseLabel || 'Not recorded',
      student.lastSeen ? sessionTitle(student.lastSeen) : '',
    ]);
    const csv = [['Student', 'Student ID', 'Sessions attended', 'Attendance', 'Participation', 'Knowledge checks', 'Pulse trend', 'Latest pulse', 'Last session'], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedCourse?.code || 'all-classes'}-progress.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const filterOptions: Array<{ id: SmartFilter; label: string; help: string; icon: typeof Filter }> = [
    { id: 'all', label: 'Everyone', help: 'Every student in this class', icon: Users },
    { id: 'check-in', label: 'Check in', help: 'More than one signal may need attention', icon: AlertCircle },
    { id: 'attendance', label: 'Attendance below 75%', help: 'After at least two held sessions', icon: CalendarCheck },
    { id: 'quiet', label: 'Quiet lately', help: 'Attended but did not respond in the last two sessions', icon: Filter },
    { id: 'pulse', label: 'Pulse follow-up', help: 'Repeated concern or a serious latest signal', icon: HeartPulse },
    { id: 'momentum', label: 'Strong momentum', help: 'Consistent attendance and participation', icon: Sparkles },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-[1600px] p-5 sm:p-8 lg:p-10">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="seminar-eyebrow mb-3">Student progress</p>
              <h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">See how students are showing up.</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#697087]">Follow attendance, participation, understanding, and pulse signals across the course. Start with a pattern, then open the student record for context.</p>
            </div>
            <Button variant="outline" onClick={exportProgress} disabled={visibleStudents.length === 0} className="gap-2 self-start lg:self-auto"><Download className="h-4 w-4" /> Export this view</Button>
          </header>

          {error && <InlineMessage className="mt-6" title="Progress is taking a moment." message={error} />}
          {loading ? <div className="grid min-h-80 place-items-center" role="status" aria-label="Loading student progress"><AmbientLoading className="w-44 rounded-full" announce="off" /></div> : (
            <>
              <section className="mt-8 rounded-3xl border border-[#e1e3ec] bg-white p-3 shadow-[0_18px_50px_rgba(16,26,56,0.05)]" aria-labelledby="class-scope-heading">
                <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
                  <div><p className="seminar-eyebrow" id="class-scope-heading">Choose a class</p><p className="mt-1 text-sm text-[#697087]">Everything below updates to this course.</p></div>
                  {selectedCourse && <Link href={`/dashboard/classes/${selectedCourse.id}`} className="seminar-focus hidden items-center gap-1 rounded-lg text-sm font-bold text-[#5146e5] sm:inline-flex">Open class <ChevronRight className="h-4 w-4" /></Link>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Classes">
                  <button type="button" onClick={() => selectCourse('all')} aria-pressed={selectedCourseId === 'all'} className={`min-w-[178px] rounded-2xl border px-4 py-3 text-left transition ${selectedCourseId === 'all' ? 'border-[#5146e5] bg-[#f0efff] shadow-[inset_0_0_0_1px_#5146e5]' : 'border-[#e3e5ed] bg-[#fffefa] hover:border-[#b9b5ec]'}`}>
                    <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">All classes</span>
                    <strong className="mt-1 block text-sm text-[#101a38]">Teaching overview</strong>
                    <span className="mt-1 block text-xs text-[#697087]">{courses.length} active {courses.length === 1 ? 'class' : 'classes'}</span>
                  </button>
                  {courses.map((course) => {
                    const courseSessions = sessions.filter((session) => session.courseId === course.id || (!session.courseId && session.courseCode === course.code));
                    const held = courseSessions.filter((session) => session.startedAt || session.endedAt || session.active || (session.studentsJoined?.length || 0) > 0).length;
                    const selected = selectedCourseId === course.id;
                    return <button key={course.id} type="button" onClick={() => selectCourse(course.id)} aria-pressed={selected} className={`min-w-[250px] rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-[#5146e5] bg-[#f0efff] shadow-[inset_0_0_0_1px_#5146e5]' : 'border-[#e3e5ed] bg-[#fffefa] hover:border-[#b9b5ec]'}`}>
                      <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">{course.code}</span>
                      <strong className="mt-1 block truncate text-sm text-[#101a38]">{course.name}</strong>
                      <span className="mt-1 block text-xs text-[#697087]">{course.term || 'Current term'} · {held} {held === 1 ? 'session' : 'sessions'}</span>
                    </button>;
                  })}
                </div>
              </section>

              <section className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-[#e1e3ec] bg-[#e1e3ec] sm:grid-cols-2 xl:grid-cols-4" aria-label="Progress summary">
                {[
                  [Users, scopedRows.length, 'Students', 'Seen in recorded sessions', '#f0efff', '#5146e5'],
                  [CalendarCheck, `${averageAttendance}%`, 'Average attendance', `${heldSessions.length} held ${heldSessions.length === 1 ? 'session' : 'sessions'}`, '#edf8f0', '#32864a'],
                  [BookOpenCheck, averageParticipation === null ? '—' : `${averageParticipation}%`, 'Participation', averageParticipation === null ? 'No live responses yet' : 'Played moments answered', '#eef6ff', '#2f73df'],
                  [Sparkles, activeParticipants, 'Strong momentum', 'Consistent attendance and participation', '#fff6d9', '#aa7200'],
                ].map(([Icon, value, label, help, background, color]) => {
                  const StatIcon = Icon as typeof Users;
                  return <article key={String(label)} className="flex items-center gap-4 bg-white p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: String(background), color: String(color) }}><StatIcon className="h-5 w-5" /></span><div><strong className="block text-2xl text-[#101a38]">{String(value)}</strong><span className="block text-sm font-bold text-[#313950]">{String(label)}</span><p className="mt-0.5 text-xs text-[#697087]">{String(help)}</p></div></article>;
                })}
              </section>

              <section className="mt-6 rounded-3xl border border-[#e1e3ec] bg-[#101a38] p-5 text-white sm:p-7" aria-labelledby="course-signals-heading">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b8b3ff]">Across the course</p><h2 id="course-signals-heading" className="seminar-display mt-2 text-3xl">See the class taking shape.</h2><p className="mt-2 text-sm leading-6 text-[#cbd0df]">Each point is one completed or active session. Trends appear after two sessions.</p></div>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#e6e4ff]">Last {sessionSignals.length} {sessionSignals.length === 1 ? 'session' : 'sessions'}</span>
                </div>
                {sessionSignals.length < 2 ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-5"><strong className="text-sm">One more session will reveal the first trend.</strong><p className="mt-1 text-sm text-[#cbd0df]">The student table below is ready to use now.</p></div>
                ) : (
                  <div className="mt-7 grid gap-4 lg:grid-cols-3">
                    {[
                      { label: 'Attendance', detail: 'Students present', values: sessionSignals.map((signal) => signal.attendance), color: '#6ee7a0' },
                      { label: 'Participation', detail: 'Attendees who responded', values: sessionSignals.map((signal) => signal.participation), color: '#8ba7ff' },
                      { label: 'Pulse ready', detail: 'Pulse responses without a follow-up signal', values: sessionSignals.map((signal) => signal.pulseReady), color: '#ffd15c' },
                    ].map((signal) => {
                      const latest = [...signal.values].reverse().find((value) => value !== null);
                      const path = signalPath(signal.values);
                      return <article key={signal.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{signal.label}</strong><p className="mt-0.5 text-xs text-[#aeb6ca]">{signal.detail}</p></div><span className="text-xl font-bold" style={{ color: signal.color }}>{latest === undefined ? '—' : `${latest}%`}</span></div>
                        <svg className="mt-5 h-[76px] w-full overflow-visible" viewBox="0 0 560 76" preserveAspectRatio="none" role="img" aria-label={`${signal.label} over recent sessions`}>
                          <line x1="0" y1="72" x2="560" y2="72" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
                          {path && <polyline points={path} fill="none" stroke={signal.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                          {signal.values.map((value, index) => value === null ? null : <circle key={index} cx={signal.values.length === 1 ? 280 : (index / (signal.values.length - 1)) * 560} cy={72 - (value / 100) * 72} r="5" fill={signal.color} stroke="#101a38" strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
                        </svg>
                        <div className="mt-3 flex justify-between gap-1 text-[10px] text-[#aeb6ca]">{sessionSignals.map(({ session }) => <span key={session.id} className="max-w-16 truncate" title={sessionTitle(session)}>{shortSessionTitle(session)}</span>)}</div>
                      </article>;
                    })}
                  </div>
                )}
              </section>

              <section className="mt-6 overflow-hidden rounded-3xl border border-[#e1e3ec] bg-white shadow-[0_18px_50px_rgba(16,26,56,0.05)]" aria-labelledby="individual-progress-heading">
                <div className="border-b border-[#e3e5ed] p-5 sm:p-7">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div><p className="seminar-eyebrow mb-2">Class roster</p><h2 id="individual-progress-heading" className="seminar-display text-3xl text-[#101a38]">Individual progress</h2><p className="mt-1 text-sm text-[#697087]">Find a pattern first. Review a student only when you need more context.</p></div>
                    <div className="relative w-full lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9298a8]" /><Input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or student ID" className="pl-9" /></div>
                  </div>
                  <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Smart student filters">
                    {filterOptions.map(({ id, label, help, icon: Icon }) => {
                      const selected = smartFilter === id;
                      return <button key={id} type="button" onClick={() => setSmartFilter(id)} aria-pressed={selected} title={help} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition ${selected ? 'border-[#5146e5] bg-[#5146e5] text-white' : 'border-[#dfe2ea] bg-white text-[#4f586f] hover:border-[#aaa5e5] hover:bg-[#f8f7ff]'}`}><Icon className="h-4 w-4" />{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? 'bg-white/18 text-white' : 'bg-[#f0eff5] text-[#697087]'}`}>{filterCounts[id]}</span></button>;
                    })}
                  </div>
                  {smartFilter !== 'all' && <div className="mt-3 flex items-center gap-2 text-xs text-[#697087]"><Check className="h-3.5 w-3.5 text-[#5146e5]" /><span>{filterOptions.find((filter) => filter.id === smartFilter)?.help}</span><button type="button" onClick={() => setSmartFilter('all')} className="seminar-focus ml-1 inline-flex items-center gap-1 rounded text-xs font-bold text-[#5146e5]">Clear <X className="h-3 w-3" /></button></div>}
                </div>

                {visibleStudents.length === 0 ? (
                  <div className="py-16 text-center"><UserCheck className="mx-auto h-9 w-9 text-[#9ca2b2]" /><h3 className="seminar-display mt-3 text-2xl text-[#101a38]">No students match this view.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#697087]">Try another filter or search. New students appear after joining with their student number.</p>{(smartFilter !== 'all' || search) && <button type="button" onClick={() => { setSmartFilter('all'); setSearch(''); }} className="seminar-focus mt-4 rounded-lg text-sm font-bold text-[#5146e5]">Show everyone</button>}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] text-left">
                      <thead className="bg-[#fbfaff]"><tr className="border-b border-[#e3e5ed] text-[11px] font-bold uppercase tracking-[0.07em] text-[#697087]">
                        <th className="sticky left-0 z-10 min-w-[230px] bg-[#fbfaff] px-6 py-4"><button type="button" onClick={() => updateSort('name')} className="flex items-center gap-1.5">Student <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                        <th className="px-4 py-4"><button type="button" onClick={() => updateSort('attendance')} className="flex items-center gap-1.5">Attendance <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                        <th className="px-4 py-4"><button type="button" onClick={() => updateSort('participation')} className="flex items-center gap-1.5">Participation <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                        <th className="px-4 py-4"><button type="button" onClick={() => updateSort('quiz')} className="flex items-center gap-1.5">Knowledge checks <ArrowUpDown className="h-3.5 w-3.5" /></button></th>
                        <th className="min-w-[210px] px-4 py-4">Pulse trend</th>
                        <th className="min-w-[190px] px-4 py-4">Recent sessions</th>
                        <th className="px-6 py-4 text-right">Student record</th>
                      </tr></thead>
                      <tbody>{visibleStudents.map((student) => <tr key={student.id} className="group border-b border-[#eceef3] last:border-0 hover:bg-[#fbfaff]">
                        <td className="sticky left-0 z-[1] bg-white px-6 py-4 group-hover:bg-[#fbfaff]"><div className="min-w-0 border-l-2 border-[#dcd8ff] pl-3"><strong className="block truncate text-sm text-[#101a38]">{student.name || 'Student'}</strong><span className="text-xs text-[#697087]">{student.studentId}</span>{student.needsCheckIn && <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-[#fff0eb] px-2 py-0.5 text-[10px] font-bold text-[#ad4d39]"><AlertCircle className="h-3 w-3" /> Check in</span>}</div></td>
                        <td className="px-4 py-4"><strong className={`block text-sm ${student.attendance < 60 && heldSessions.length >= 2 ? 'text-[#b6533f]' : 'text-[#101a38]'}`}>{student.attendance}%</strong><span className="text-xs text-[#697087]">{student.attended} of {heldSessions.length}</span></td>
                        <td className="px-4 py-4"><strong className="block text-sm text-[#101a38]">{student.liveMetrics.participationRate === null ? 'Not recorded' : `${student.liveMetrics.participationRate}%`}</strong><span className="text-xs text-[#697087]">{student.liveMetrics.responses} of {student.liveMetrics.responseOpportunities} played moments</span></td>
                        <td className="px-4 py-4"><strong className="block text-sm text-[#101a38]">{student.liveMetrics.quizPercentage === null ? 'Not recorded' : `${student.liveMetrics.quizPercentage}%`}</strong><span className="text-xs text-[#697087]">{student.liveMetrics.quizAnswered ? `${student.liveMetrics.quizCorrect} of ${student.liveMetrics.quizAnswered} correct` : 'No knowledge check answers yet'}</span></td>
                        <td className="px-4 py-4"><PulseTrendCell trend={student.liveMetrics.pulseTrend} latestLabel={student.liveMetrics.latestPulseLabel} /></td>
                        <td className="px-4 py-4"><div className="flex items-center gap-2" aria-label="Recent session activity">{student.liveMetrics.sessionStates.slice(-6).map(({ session, state }) => <span key={session.id} className={`h-3 w-3 rounded-full ring-2 ring-white ${state === 'responded' ? 'bg-[#5146e5]' : state === 'attended' ? 'bg-[#ffd15c]' : 'bg-[#dfe2ea]'}`} title={`${sessionTitle(session)}: ${state}`} />)}</div><span className="mt-2 block max-w-44 truncate text-xs text-[#697087]">{student.lastSeen ? `Last seen: ${sessionTitle(student.lastSeen)}` : 'No session recorded'}</span></td>
                        <td className="px-6 py-4 text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedStudent(student)} className="gap-1.5 whitespace-nowrap"><Eye className="h-4 w-4" /> Review</Button></td>
                      </tr>)}</tbody>
                    </table>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e3e5ed] bg-[#fbfaff] px-6 py-3 text-xs text-[#697087]"><span className="font-bold text-[#313950]">Recent sessions</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#5146e5]" /> Responded</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ffd15c]" /> Attended</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#dfe2ea]" /> Missed</span><span className="ml-auto">Showing {visibleStudents.length} of {scopedRows.length}</span></div>
                  </div>
                )}
              </section>

              <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#dcd8ff] bg-[#f7f6ff] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><strong className="text-sm text-[#101a38]">Use signals as a starting point, not a verdict.</strong><p className="mt-1 text-sm leading-6 text-[#697087]">A low score can mean the concept needs reteaching. Check the student record and the class pattern before deciding what to do next.</p></div>
                {selectedCourse && <Link href={`/dashboard/classes/${selectedCourse.id}`} className="seminar-focus inline-flex shrink-0 items-center gap-2 rounded-lg text-sm font-bold text-[#5146e5]">Open class workspace <ArrowRight className="h-4 w-4" /></Link>}
              </section>
            </>
          )}
        </main>
      </DashboardLayout>
      {selectedStudent && <StudentResponseModal isOpen onClose={() => setSelectedStudent(null)} studentId={selectedStudent.studentId} studentDocId={selectedStudent.id} studentName={selectedStudent.name || 'Student'} teacherId={user?.uid || ''} />}
    </ProtectedRoute>
  );
}

export default function ProgressPage() {
  return <Suspense fallback={<ProtectedRoute><DashboardLayout><div className="grid min-h-96 place-items-center" role="status" aria-label="Opening student progress"><AmbientLoading className="w-44 rounded-full" announce="off" /></div></DashboardLayout></ProtectedRoute>}><ProgressContent /></Suspense>;
}
