import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { ensureStudentAnonymousAuth, studentDb } from './student-config';
import type { Course } from '@/types';

export const TEAM_COLORS = [
  { id: 'violet', label: 'Violet', value: '#5b4ce6' },
  { id: 'blue', label: 'Blue', value: '#2f73df' },
  { id: 'teal', label: 'Teal', value: '#238b78' },
  { id: 'green', label: 'Green', value: '#3d9456' },
  { id: 'gold', label: 'Gold', value: '#d99f18' },
  { id: 'coral', label: 'Coral', value: '#df664e' },
  { id: 'pink', label: 'Pink', value: '#c85f92' },
  { id: 'navy', label: 'Navy', value: '#24366f' },
] as const;

export type TeamColorId = typeof TEAM_COLORS[number]['id'];

export type TeamModule = {
  courseId: string;
  teacherId: string;
  courseCode: string;
  courseName: string;
  term?: string;
  tags: string[];
  enabled: boolean;
};

export type CourseTeamRecord = {
  id: string;
  courseId: string;
  teacherId: string;
  name: string;
  normalizedName: string;
  description?: string;
  tag?: string;
  color: TeamColorId;
  creatorUid: string;
};

export type CourseTeamMembership = {
  id: string;
  courseId: string;
  teacherId: string;
  teamId: string;
  studentUid: string;
  studentNumber: string;
  displayName?: string;
};

export type CourseTeamWithMembers = CourseTeamRecord & {
  members: Array<{
    membershipId: string;
    studentUid: string;
    studentNumber?: string;
    displayName?: string;
    addedByInstructor?: boolean;
  }>;
  memberCount: number;
};

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}

export function normalizeTeamName(value: string) {
  return value.trim().normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48);
}

export function normalizeTeamStudentNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9._-]/g, '').slice(0, 32);
}

function membershipId(_courseId: string, studentUid: string) {
  return studentUid;
}

function claimId(_courseId: string, normalizedName: string) {
  return normalizedName;
}

export async function ensureTeamModule(course: Course): Promise<TeamModule> {
  const teamModule: TeamModule = {
    courseId: course.id,
    teacherId: course.teacherId,
    courseCode: course.code,
    courseName: course.name,
    ...(course.term ? { term: course.term } : {}),
    tags: course.teamTags || [],
    enabled: !course.archived,
  };
  await setDoc(doc(db, 'teamModules', course.id), { ...teamModule, updatedAt: serverTimestamp() }, { merge: true });
  return teamModule;
}

export async function getStudentTeamModule(courseId: string): Promise<TeamModule | null> {
  await ensureStudentAnonymousAuth();
  const snapshot = await getDoc(doc(studentDb, 'teamModules', courseId));
  return snapshot.exists() ? snapshot.data() as TeamModule : null;
}

export async function getStudentMembership(courseId: string): Promise<CourseTeamMembership | null> {
  const user = await ensureStudentAnonymousAuth();
  const snapshot = await getDoc(doc(studentDb, 'teamModules', courseId, 'memberships', membershipId(courseId, user.uid)));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as CourseTeamMembership : null;
}

export function subscribeStudentTeams(courseId: string, callback: (teams: CourseTeamRecord[]) => void): Unsubscribe {
  return onSnapshot(collection(studentDb, 'teamModules', courseId, 'teams'), (snapshot) => {
    callback(snapshot.docs.map((teamDoc) => ({ id: teamDoc.id, ...teamDoc.data() } as CourseTeamRecord)).sort((a, b) => a.name.localeCompare(b.name)));
  });
}

export async function joinCourseTeam(input: {
  courseId: string;
  teacherId: string;
  teamId: string;
  studentNumber: string;
  displayName?: string;
}) {
  const user = await ensureStudentAnonymousAuth();
  await setDoc(doc(studentDb, 'teamModules', input.courseId, 'memberships', membershipId(input.courseId, user.uid)), withoutUndefined({
    courseId: input.courseId,
    teacherId: input.teacherId,
    teamId: input.teamId,
    studentUid: user.uid,
    studentNumber: input.studentNumber,
    displayName: input.displayName,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
}

export async function createCourseTeam(input: {
  module: TeamModule;
  name: string;
  description?: string;
  tag?: string;
  color: TeamColorId;
  studentNumber: string;
  displayName?: string;
}): Promise<string> {
  const user = await ensureStudentAnonymousAuth();
  const normalizedName = normalizeTeamName(input.name);
  if (normalizedName.length < 2) throw new Error('Give your team a more distinctive name.');
  const claimRef = doc(studentDb, 'teamModules', input.module.courseId, 'nameClaims', claimId(input.module.courseId, normalizedName));
  if ((await getDoc(claimRef)).exists()) throw new Error('That team name is already in use. Choose it from the list instead.');
  const teamRef = doc(collection(studentDb, 'teamModules', input.module.courseId, 'teams'));
  const batch = writeBatch(studentDb);
  batch.set(claimRef, {
    courseId: input.module.courseId,
    teacherId: input.module.teacherId,
    normalizedName,
    teamId: teamRef.id,
    creatorUid: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(teamRef, withoutUndefined({
    courseId: input.module.courseId,
    teacherId: input.module.teacherId,
    name: input.name.trim(),
    normalizedName,
    description: input.description?.trim() || undefined,
    tag: input.tag || undefined,
    color: input.color,
    creatorUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  batch.set(doc(studentDb, 'teamModules', input.module.courseId, 'memberships', membershipId(input.module.courseId, user.uid)), withoutUndefined({
    courseId: input.module.courseId,
    teacherId: input.module.teacherId,
    teamId: teamRef.id,
    studentUid: user.uid,
    studentNumber: input.studentNumber,
    displayName: input.displayName,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await batch.commit();
  return teamRef.id;
}

export async function createInstructorCourseTeam(input: {
  module: TeamModule;
  name: string;
  description?: string;
  tag?: string;
  color: TeamColorId;
}): Promise<string> {
  const normalizedName = normalizeTeamName(input.name);
  if (normalizedName.length < 2) throw new Error('Use a team name with at least two letters or numbers.');

  const claimRef = doc(db, 'teamModules', input.module.courseId, 'nameClaims', claimId(input.module.courseId, normalizedName));
  if ((await getDoc(claimRef)).exists()) throw new Error('That team name is already in use.');

  const teamRef = doc(collection(db, 'teamModules', input.module.courseId, 'teams'));
  const batch = writeBatch(db);
  batch.set(claimRef, {
    courseId: input.module.courseId,
    teacherId: input.module.teacherId,
    normalizedName,
    teamId: teamRef.id,
    creatorUid: input.module.teacherId,
    createdAt: serverTimestamp(),
  });
  batch.set(teamRef, withoutUndefined({
    courseId: input.module.courseId,
    teacherId: input.module.teacherId,
    name: input.name.trim(),
    normalizedName,
    description: input.description?.trim() || undefined,
    tag: input.tag || undefined,
    color: input.color,
    creatorUid: input.module.teacherId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await batch.commit();
  return teamRef.id;
}

export async function updateInstructorCourseTeam(input: {
  team: CourseTeamRecord;
  name: string;
  description?: string;
  tag?: string;
  color: TeamColorId;
}) {
  const normalizedName = normalizeTeamName(input.name);
  if (normalizedName.length < 2) throw new Error('Use a team name with at least two letters or numbers.');

  const teamRef = doc(db, 'teamModules', input.team.courseId, 'teams', input.team.id);
  if (normalizedName === input.team.normalizedName) {
    await updateDoc(teamRef, withoutUndefined({
      name: input.name.trim(),
      description: input.description?.trim() || '',
      tag: input.tag || '',
      color: input.color,
      updatedAt: serverTimestamp(),
    }));
    return;
  }

  const newClaimRef = doc(db, 'teamModules', input.team.courseId, 'nameClaims', claimId(input.team.courseId, normalizedName));
  if ((await getDoc(newClaimRef)).exists()) throw new Error('That team name is already in use.');
  const batch = writeBatch(db);
  batch.set(newClaimRef, {
    courseId: input.team.courseId,
    teacherId: input.team.teacherId,
    normalizedName,
    teamId: input.team.id,
    creatorUid: input.team.creatorUid,
    createdAt: serverTimestamp(),
  });
  batch.update(teamRef, withoutUndefined({
    name: input.name.trim(),
    normalizedName,
    description: input.description?.trim() || '',
    tag: input.tag || '',
    color: input.color,
    updatedAt: serverTimestamp(),
  }));
  batch.delete(doc(db, 'teamModules', input.team.courseId, 'nameClaims', claimId(input.team.courseId, input.team.normalizedName)));
  await batch.commit();
}

export async function updateCourseTeam(input: {
  team: CourseTeamRecord;
  name: string;
  description?: string;
  tag?: string;
  color: TeamColorId;
}) {
  const user = await ensureStudentAnonymousAuth();
  if (input.team.creatorUid !== user.uid) throw new Error('Only the person who created this team can edit its details.');
  const normalizedName = normalizeTeamName(input.name);
  if (normalizedName.length < 2) throw new Error('Give your team a more distinctive name.');
  const teamRef = doc(studentDb, 'teamModules', input.team.courseId, 'teams', input.team.id);
  if (normalizedName === input.team.normalizedName) {
    await updateDoc(teamRef, withoutUndefined({
      name: input.name.trim(),
      description: input.description?.trim() || '',
      tag: input.tag || '',
      color: input.color,
      updatedAt: serverTimestamp(),
    }));
    return;
  }
  const newClaimRef = doc(studentDb, 'teamModules', input.team.courseId, 'nameClaims', claimId(input.team.courseId, normalizedName));
  if ((await getDoc(newClaimRef)).exists()) throw new Error('That team name is already in use.');
  const batch = writeBatch(studentDb);
  batch.set(newClaimRef, {
    courseId: input.team.courseId,
    teacherId: input.team.teacherId,
    normalizedName,
    teamId: input.team.id,
    creatorUid: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.update(teamRef, withoutUndefined({
    name: input.name.trim(),
    normalizedName,
    description: input.description?.trim() || '',
    tag: input.tag || '',
    color: input.color,
    updatedAt: serverTimestamp(),
  }));
  batch.delete(doc(studentDb, 'teamModules', input.team.courseId, 'nameClaims', claimId(input.team.courseId, input.team.normalizedName)));
  await batch.commit();
}

export async function getInstructorTeamRoster(courseId: string, teacherId: string): Promise<CourseTeamWithMembers[]> {
  const [teamSnapshot, membershipSnapshot] = await Promise.all([
    getDocs(collection(db, 'teamModules', courseId, 'teams')),
    getDocs(collection(db, 'teamModules', courseId, 'memberships')),
  ]);
  const memberships = membershipSnapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() } as CourseTeamMembership)).filter((member) => member.courseId === courseId && member.teacherId === teacherId);
  return teamSnapshot.docs.map((teamDoc) => {
    const team = { id: teamDoc.id, ...teamDoc.data() } as CourseTeamRecord;
    const members = uniqueRosterMembers(memberships).filter((member) => member.teamId === team.id).map((member) => ({ membershipId: member.id, studentUid: member.studentUid, studentNumber: member.studentNumber, displayName: member.displayName, addedByInstructor: member.id.startsWith('assigned-') }));
    return { ...team, members, memberCount: members.length };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function syncInstructorTeamsToModule(courseId: string, teacherId: string, teams: Array<{
  id: string;
  name: string;
  description?: string;
  tag?: string;
  color?: TeamColorId;
  creatorUid?: string;
  members?: Array<{ studentUid: string; studentNumber?: string; displayName?: string }>;
}>) {
  const [moduleSnapshot, teamSnapshot, claimSnapshot] = await Promise.all([
    getDoc(doc(db, 'teamModules', courseId)),
    getDocs(collection(db, 'teamModules', courseId, 'teams')),
    getDocs(collection(db, 'teamModules', courseId, 'nameClaims')),
  ]);
  if (!moduleSnapshot.exists()) return;
  const existingTeams = new Map(teamSnapshot.docs.map((teamDoc) => [teamDoc.id, { id: teamDoc.id, ...teamDoc.data() } as CourseTeamRecord]));
  const claims = new Map(claimSnapshot.docs.map((claimDoc) => [String(claimDoc.data().normalizedName), { id: claimDoc.id, ...claimDoc.data() } as { id: string; teamId: string; normalizedName: string }]));
  const batch = writeBatch(db);
  teams.forEach((team) => {
    const normalizedName = normalizeTeamName(team.name);
    if (normalizedName.length < 2) return;
    const claimedTeamId = claims.get(normalizedName)?.teamId;
    const actualTeamId = claimedTeamId || team.id;
    const existing = existingTeams.get(actualTeamId);
    const creatorUid = existing?.creatorUid || team.creatorUid || team.members?.[0]?.studentUid || teacherId;
    if (!claimedTeamId) {
      batch.set(doc(db, 'teamModules', courseId, 'nameClaims', claimId(courseId, normalizedName)), {
        courseId,
        teacherId,
        normalizedName,
        teamId: actualTeamId,
        creatorUid,
        createdAt: serverTimestamp(),
      });
    }
    batch.set(doc(db, 'teamModules', courseId, 'teams', actualTeamId), withoutUndefined({
      courseId,
      teacherId,
      name: team.name,
      normalizedName,
      description: team.description || '',
      tag: team.tag || '',
      color: team.color || existing?.color || 'violet',
      creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), { merge: true });
    team.members?.forEach((member) => {
      if (!member.studentNumber) return;
      batch.set(doc(db, 'teamModules', courseId, 'memberships', membershipId(courseId, member.studentUid)), withoutUndefined({
        courseId,
        teacherId,
        teamId: actualTeamId,
        studentUid: member.studentUid,
        studentNumber: member.studentNumber,
        displayName: member.displayName,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }), { merge: true });
    });
  });
  await batch.commit();
}

export function subscribeInstructorTeamRoster(courseId: string, teacherId: string, callback: (teams: CourseTeamWithMembers[]) => void): Unsubscribe {
  let teams: CourseTeamRecord[] = [];
  let memberships: CourseTeamMembership[] = [];
  const publish = () => callback(teams.map((team) => {
    const members = uniqueRosterMembers(memberships).filter((member) => member.teamId === team.id).map((member) => ({ membershipId: member.id, studentUid: member.studentUid, studentNumber: member.studentNumber, displayName: member.displayName, addedByInstructor: member.id.startsWith('assigned-') }));
    return { ...team, members, memberCount: members.length };
  }).sort((a, b) => a.name.localeCompare(b.name)));
  const stopTeams = onSnapshot(collection(db, 'teamModules', courseId, 'teams'), (snapshot) => {
    teams = snapshot.docs.map((teamDoc) => ({ id: teamDoc.id, ...teamDoc.data() } as CourseTeamRecord));
    publish();
  });
  const stopMembers = onSnapshot(collection(db, 'teamModules', courseId, 'memberships'), (snapshot) => {
    memberships = snapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() } as CourseTeamMembership)).filter((member) => member.courseId === courseId);
    publish();
  });
  return () => { stopTeams(); stopMembers(); };
}

function uniqueRosterMembers(memberships: CourseTeamMembership[]) {
  const membersByNumber = new Map<string, CourseTeamMembership>();
  memberships.forEach((member) => {
    const normalizedNumber = normalizeTeamStudentNumber(member.studentNumber);
    const key = normalizedNumber || member.studentUid;
    const current = membersByNumber.get(key);
    if (!current || (current.id.startsWith('assigned-') && !member.id.startsWith('assigned-'))) membersByNumber.set(key, member);
  });
  return [...membersByNumber.values()];
}

export async function addInstructorTeamMember(input: {
  team: CourseTeamRecord;
  studentNumber: string;
  displayName?: string;
}) {
  const studentNumber = normalizeTeamStudentNumber(input.studentNumber);
  if (studentNumber.length < 3) throw new Error('Enter a student number with at least three characters.');
  const membershipsRef = collection(db, 'teamModules', input.team.courseId, 'memberships');
  const membershipSnapshot = await getDocs(membershipsRef);
  const matchingMemberships = membershipSnapshot.docs.filter((memberDoc) => normalizeTeamStudentNumber(String(memberDoc.data().studentNumber || '')) === studentNumber);
  const assignedId = `assigned-${studentNumber}`;
  const targetMemberships = matchingMemberships.filter((memberDoc) => !memberDoc.id.startsWith('assigned-'));
  const batch = writeBatch(db);

  if (targetMemberships.length) {
    targetMemberships.forEach((memberDoc) => batch.set(memberDoc.ref, withoutUndefined({
      teamId: input.team.id,
      displayName: input.displayName?.trim() || memberDoc.data().displayName || undefined,
      updatedAt: serverTimestamp(),
    }), { merge: true }));
    matchingMemberships.filter((memberDoc) => memberDoc.id.startsWith('assigned-')).forEach((memberDoc) => batch.delete(memberDoc.ref));
  } else {
    batch.set(doc(membershipsRef, assignedId), withoutUndefined({
      courseId: input.team.courseId,
      teacherId: input.team.teacherId,
      teamId: input.team.id,
      studentUid: assignedId,
      studentNumber,
      displayName: input.displayName?.trim() || undefined,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      addedByInstructor: true,
    }), { merge: true });
  }
  await batch.commit();
}

export async function removeInstructorTeamMember(input: { team: CourseTeamRecord; studentNumber: string }) {
  const studentNumber = normalizeTeamStudentNumber(input.studentNumber);
  const membershipSnapshot = await getDocs(collection(db, 'teamModules', input.team.courseId, 'memberships'));
  const matches = membershipSnapshot.docs.filter((memberDoc) => normalizeTeamStudentNumber(String(memberDoc.data().studentNumber || '')) === studentNumber);
  if (!matches.length) return;
  const batch = writeBatch(db);
  matches.forEach((memberDoc) => batch.delete(memberDoc.ref));
  await batch.commit();
}

export async function deleteInstructorCourseTeam(team: CourseTeamRecord) {
  const membershipSnapshot = await getDocs(collection(db, 'teamModules', team.courseId, 'memberships'));
  const batch = writeBatch(db);
  membershipSnapshot.docs.filter((memberDoc) => memberDoc.data().teamId === team.id).forEach((memberDoc) => batch.delete(memberDoc.ref));
  batch.delete(doc(db, 'teamModules', team.courseId, 'nameClaims', claimId(team.courseId, team.normalizedName)));
  batch.delete(doc(db, 'teamModules', team.courseId, 'teams', team.id));
  await batch.commit();
}
