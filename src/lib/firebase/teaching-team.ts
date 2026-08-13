'use client';

import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import type { InstructorMembership, InstructorMembershipRole, InstructorMembershipScope } from '@/types';

type TeamList = {
  ownerUid: string;
  owner: { name: string; email: string; photoURL: string };
  members: InstructorMembership[];
};

const teachingTeamCall = httpsCallable<Record<string, unknown>, unknown>(functions, 'getInstructorBilling');
const listCall = async (input: { courseId?: string }) => ({ data: await teachingTeamCall({ teachingTeamAction: 'list', ...input }).then((result) => result.data as TeamList) });
type InviteInput = {
  email: string;
  role: InstructorMembershipRole;
  scope: InstructorMembershipScope;
  courseId?: string;
};
type InviteResult = { membership: InstructorMembership; invitationSent: boolean; resent: boolean };
const inviteCall = async (input: InviteInput) => ({ data: await teachingTeamCall({ teachingTeamAction: 'invite', ...input }).then((result) => result.data as InviteResult) });
const revokeCall = async (input: { membershipId: string }) => ({ data: await teachingTeamCall({ teachingTeamAction: 'revoke', ...input }).then((result) => result.data as { membershipId: string }) });
const acceptCall = async (input: { token: string }) => ({ data: await teachingTeamCall({ teachingTeamAction: 'accept', ...input }).then((result) => result.data as { courseId?: string }) });

export async function listTeachingTeam(courseId?: string): Promise<TeamList> {
  return (await listCall(courseId ? { courseId } : {})).data;
}

export async function inviteTeachingTeamMember(input: {
  email: string;
  role: InstructorMembershipRole;
  scope: InstructorMembershipScope;
  courseId?: string;
}) {
  return (await inviteCall(input)).data;
}

export async function revokeTeachingTeamMember(membershipId: string) {
  return (await revokeCall({ membershipId })).data;
}

export async function acceptTeachingTeamInvitation(token: string) {
  return (await acceptCall({ token })).data;
}
