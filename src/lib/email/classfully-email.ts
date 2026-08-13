const CLASSFULLY_URL = 'https://classfully.com';
const CLASSFULLY_MARK_URL = `${CLASSFULLY_URL}/icon.svg`;
const MANAGE_EMAIL_URL = `${CLASSFULLY_URL}/dashboard/settings#email-reports`;

type EmailMetric = {
  label: string;
  value: string;
  note: string;
  color: 'violet' | 'green' | 'gold' | 'coral';
};

type EmailTemplateInput = {
  subject: string;
  previewText: string;
  eyebrow: string;
  title: string;
  intro: string;
  recipientName: string;
  courseCode?: string;
  courseName?: string;
  periodLabel: string;
  metrics: EmailMetric[];
  insightLabel?: string;
  insightTitle: string;
  insightBody: string;
  actions: Array<{ title: string; body: string }>;
  ctaLabel: string;
  ctaUrl: string;
  closingNote: string;
  privacyNote?: string;
};

export type ClassfullyEmail = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

const metricColors: Record<EmailMetric['color'], { foreground: string; background: string }> = {
  violet: { foreground: '#5146e5', background: '#eeecff' },
  green: { foreground: '#25804a', background: '#e8f7ed' },
  gold: { foreground: '#9a6a00', background: '#fff3c9' },
  coral: { foreground: '#b84f3d', background: '#ffebe6' },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value, CLASSFULLY_URL);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? escapeHtml(url.toString())
      : CLASSFULLY_URL;
  } catch {
    return CLASSFULLY_URL;
  }
}

function renderMetric(metric: EmailMetric, metricCount: number): string {
  const color = metricColors[metric.color];
  const width = `${100 / Math.max(metricCount, 1)}%`;
  return `
    <td class="metric-column" width="${width}" valign="top" style="width:${width};padding:0 6px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:${color.background};border-radius:14px;">
        <tr><td style="padding:16px 14px 15px;">
          <div style="font-family:Arial,sans-serif;font-size:11px;line-height:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#697087;">${escapeHtml(metric.label)}</div>
          <div style="padding-top:7px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:32px;font-weight:700;color:${color.foreground};">${escapeHtml(metric.value)}</div>
          <div style="padding-top:4px;font-family:Arial,sans-serif;font-size:12px;line-height:17px;color:#697087;">${escapeHtml(metric.note)}</div>
        </td></tr>
      </table>
    </td>`;
}

function renderAction(action: { title: string; body: string }, index: number): string {
  return `
    <tr>
      <td width="38" valign="top" style="padding:12px 12px 12px 0;">
        <div style="width:30px;height:30px;border-radius:50%;background:#eeecff;font-family:Arial,sans-serif;font-size:13px;line-height:30px;font-weight:700;text-align:center;color:#5146e5;">${index + 1}</div>
      </td>
      <td valign="top" style="padding:12px 0;border-bottom:1px solid #e3e5ed;">
        <div style="font-family:Arial,sans-serif;font-size:15px;line-height:21px;font-weight:700;color:#101a38;">${escapeHtml(action.title)}</div>
        <div style="padding-top:3px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#697087;">${escapeHtml(action.body)}</div>
      </td>
    </tr>`;
}

function renderClassfullyEmail(input: EmailTemplateInput): ClassfullyEmail {
  const metrics = input.metrics.map((metric) => renderMetric(metric, input.metrics.length)).join('');
  const metricsSection = input.metrics.length > 0
    ? `<tr><td class="email-pad" style="padding:0 30px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${metrics}</tr></table>
      </td></tr>`
    : '';
  const actions = input.actions.map(renderAction).join('');
  const actionsSection = input.actions.length > 0
    ? `<tr><td class="email-pad" style="padding:6px 36px 14px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5146e5;">Next steps</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">${actions}</table>
      </td></tr>`
    : '';
  const courseContext = input.courseCode || input.courseName
    ? `<tr><td class="email-pad" style="padding:24px 36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td class="course-code" style="font-family:Arial,sans-serif;font-size:13px;line-height:19px;font-weight:700;color:#101a38;">${escapeHtml(input.courseCode || '')}</td>
            <td class="course-name" align="right" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:21px;font-style:italic;color:#697087;">${escapeHtml(input.courseName || '')}</td>
          </tr>
        </table>
      </td></tr>`
    : '';
  const actionText = input.actions.length > 0
    ? ['', 'Next steps:', ...input.actions.map((action, index) => `${index + 1}. ${action.title}: ${action.body}`)]
    : [];
  const text = [
    input.title,
    '',
    `Hi ${input.recipientName},`,
    input.intro,
    '',
    input.courseCode || input.courseName ? `${input.courseCode || ''} | ${input.courseName || ''}` : '',
    input.periodLabel,
    '',
    ...input.metrics.map((metric) => `${metric.label}: ${metric.value} (${metric.note})`),
    '',
    input.insightTitle,
    input.insightBody,
    ...actionText,
    '',
    `${input.ctaLabel}: ${input.ctaUrl}`,
    '',
    input.closingNote,
    '',
    `Manage email reports: ${MANAGE_EMAIL_URL}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.subject)}</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-shell { width:100% !important; }
        .email-pad { padding-left:22px !important; padding-right:22px !important; }
        .metric-column { display:block !important; width:100% !important; padding-left:0 !important; padding-right:0 !important; }
        .course-code, .course-name { display:block !important; width:100% !important; text-align:left !important; }
        .course-name { padding-top:4px !important; }
        .headline { font-size:32px !important; line-height:36px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f3ef;color:#101a38;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f5f3ef;">
      <tr><td align="center" style="padding:30px 12px;">
        <table class="email-shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;border-collapse:separate;background:#fffefa;border:1px solid #e3e5ed;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(16,26,56,.08);">
          <tr><td style="height:5px;background:#5146e5;background-image:linear-gradient(90deg,#f4c94e 0%,#df664e 36%,#5146e5 70%,#73c696 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td class="email-pad" style="padding:24px 36px 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td valign="middle">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td valign="middle"><img src="${CLASSFULLY_MARK_URL}" width="30" height="30" alt="" style="display:block;width:30px;height:30px;border:0;"></td>
                    <td valign="middle" style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:28px;font-weight:700;color:#101a38;">Classfully<span style="color:#df664e;">.</span></td>
                  </tr></table>
                </td>
                <td align="right" valign="middle" style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#5146e5;">${escapeHtml(input.periodLabel)}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="email-pad" style="padding:18px 36px 30px;background:#f1efff;">
            <div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5146e5;">${escapeHtml(input.eyebrow)}</div>
            <h1 class="headline" style="margin:9px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:42px;font-weight:700;letter-spacing:-.02em;color:#101a38;">${escapeHtml(input.title)}</h1>
            <p style="margin:15px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:23px;color:#4f5871;">Hi ${escapeHtml(input.recipientName)}, ${escapeHtml(input.intro)}</p>
          </td></tr>
          ${courseContext}
          ${metricsSection}
          <tr><td class="email-pad" style="padding:12px 36px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:#eaf7ef;border-radius:16px;">
              <tr><td style="padding:18px 20px;">
                <div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#25804a;">${escapeHtml(input.insightLabel || 'What stands out')}</div>
                <div style="padding-top:7px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;color:#101a38;">${escapeHtml(input.insightTitle)}</div>
                <div style="padding-top:7px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#4f6858;">${escapeHtml(input.insightBody)}</div>
              </td></tr>
            </table>
          </td></tr>
          ${actionsSection}
          <tr><td class="email-pad" align="left" style="padding:16px 36px 30px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:999px;background:#5146e5;box-shadow:0 7px 0 #3630a9;">
              <a href="${safeUrl(input.ctaUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,sans-serif;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;color:#ffffff;">${escapeHtml(input.ctaLabel)} &nbsp;→</a>
            </td></tr></table>
            <p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#7c8294;">${escapeHtml(input.closingNote)}</p>
          </td></tr>
          <tr><td class="email-pad" style="padding:20px 36px 24px;border-top:1px solid #e3e5ed;background:#faf9f6;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;line-height:18px;color:#7c8294;">${escapeHtml(input.privacyNote || 'This report uses class-level totals. Student names and individual responses stay inside Classfully.')}</p>
            <p style="margin:9px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:18px;color:#7c8294;">Classfully is operated by Tareef Jafferi. <a href="${MANAGE_EMAIL_URL}" style="color:#5146e5;text-decoration:underline;">Manage email reports</a> or contact <a href="mailto:tareef@happily.ai" style="color:#5146e5;text-decoration:underline;">tareef@happily.ai</a>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject: input.subject, previewText: input.previewText, html, text };
}

export type AfterClassReportInput = {
  recipientName: string;
  courseCode: string;
  courseName: string;
  sessionTitle: string;
  sessionDate: string;
  attendance?: string;
  participation?: string;
  responses?: string;
  confidence?: string;
  openQuestions?: string;
  insightTitle: string;
  insightBody: string;
  actions: Array<{ title: string; body: string }>;
  dashboardUrl: string;
};

export type WelcomeEmailInput = {
  recipientName: string;
};

export function renderWelcomeEmail(input: WelcomeEmailInput): ClassfullyEmail {
  return renderClassfullyEmail({
    subject: 'Welcome to Classfully',
    previewText: 'Create your first class and prepare one live interaction.',
    eyebrow: 'Welcome to Classfully',
    title: 'Your classroom is ready.',
    intro: 'keep your slides where they are. Open Classfully when you want the room to respond.',
    recipientName: input.recipientName,
    periodLabel: 'Welcome',
    metrics: [],
    insightLabel: 'Start here',
    insightTitle: 'Plan one useful moment.',
    insightBody: 'Create a class, add a pulse or question, and open the projector before students arrive.',
    actions: [
      { title: 'Create your first class', body: 'Add the course name, code, and first session.' },
    ],
    ctaLabel: 'Create your first class',
    ctaUrl: `${CLASSFULLY_URL}/dashboard/classes`,
    closingNote: 'One interaction is enough to get started.',
    privacyNote: 'This is a service email for your Classfully instructor account.',
  });
}

export type TeachingTeamWelcomeEmailInput = {
  recipientName: string;
  role: 'co-instructor' | 'progress-viewer';
  scope: 'course' | 'workspace';
  courseName?: string;
  courseCode?: string;
  ctaUrl: string;
};

export function renderTeachingTeamWelcomeEmail(input: TeachingTeamWelcomeEmailInput): ClassfullyEmail {
  const isProgressViewer = input.role === 'progress-viewer';
  const isCourseScope = input.scope === 'course';
  const sharedSpace = isCourseScope ? input.courseName || 'the shared course' : 'the shared teaching workspace';
  return renderClassfullyEmail({
    subject: isCourseScope ? `Welcome to ${input.courseName || 'the teaching team'}` : 'Welcome to the teaching team',
    previewText: isProgressViewer
      ? `Student progress for ${sharedSpace} is ready to review.`
      : `${sharedSpace} is ready in your Classfully account.`,
    eyebrow: 'Shared teaching',
    title: isProgressViewer ? 'Your progress view is ready.' : 'You are on the teaching team.',
    intro: isProgressViewer
      ? `you can now review attendance and student progress for ${sharedSpace}.`
      : `you can now plan sessions, run class, and review student progress for ${sharedSpace}.`,
    recipientName: input.recipientName,
    periodLabel: isCourseScope ? 'Course access' : 'Workspace access',
    courseCode: isCourseScope ? input.courseCode || '' : '',
    courseName: isCourseScope ? input.courseName || '' : '',
    metrics: [],
    insightLabel: 'Your access',
    insightTitle: isProgressViewer ? 'Review without changing the class.' : 'Teach from your own account.',
    insightBody: isProgressViewer
      ? 'You can see attendance and progress, while teaching controls stay with the instructors running the course.'
      : 'Use your own sign-in to prepare activities, open sessions, and support the class alongside the teaching team.',
    actions: [
      isProgressViewer
        ? { title: 'Open student progress', body: 'See the shared course record and participation history.' }
        : { title: 'Open the shared course', body: 'Review the session flow before you teach or make changes.' },
    ],
    ctaLabel: isProgressViewer ? 'Review student progress' : isCourseScope ? 'Open the shared course' : 'View shared classes',
    ctaUrl: input.ctaUrl,
    closingNote: 'You can return to the shared space whenever you sign in to Classfully.',
    privacyNote: 'This is a service email for your Classfully teaching-team access.',
  });
}

function isTrackedMetric(value?: string): value is string {
  if (!value?.trim()) return false;
  return !/^(?:not (?:asked|tracked|available|measured)|n\/?a|—|-+)$/i.test(value.trim());
}

export function renderAfterClassReportEmail(input: AfterClassReportInput): ClassfullyEmail {
  const metrics: EmailMetric[] = [];
  if (isTrackedMetric(input.attendance)) {
    metrics.push({
      label: 'Attendance',
      value: input.attendance,
      note: input.attendance.includes('%') ? 'of the class' : 'students present',
      color: 'green',
    });
  }
  if (isTrackedMetric(input.participation)) metrics.push({ label: 'Participation', value: input.participation, note: 'contributed', color: 'violet' });
  if (isTrackedMetric(input.responses)) metrics.push({ label: 'Responses', value: input.responses, note: 'shared in class', color: 'gold' });
  if (isTrackedMetric(input.confidence)) metrics.push({ label: 'Confidence', value: input.confidence, note: 'confident', color: 'gold' });
  if (isTrackedMetric(input.openQuestions)) metrics.push({ label: 'Questions', value: input.openQuestions, note: 'still open', color: 'coral' });

  return renderClassfullyEmail({
    subject: `${input.courseCode}: your class, at a glance`,
    previewText: `See what happened in ${input.courseCode} and what to revisit next.`,
    eyebrow: 'After-class summary',
    title: input.sessionTitle,
    intro: 'here is what happened today and what may need your attention next.',
    recipientName: input.recipientName,
    courseCode: input.courseCode,
    courseName: input.courseName,
    periodLabel: input.sessionDate,
    metrics,
    insightTitle: input.insightTitle,
    insightBody: input.insightBody,
    actions: input.actions,
    ctaLabel: 'Open the session review',
    ctaUrl: input.dashboardUrl,
    closingNote: 'Open the full review for responses, questions, and student records.',
  });
}

export type WeeklyCourseDigestInput = {
  recipientName: string;
  weekLabel: string;
  sessionsRun: string;
  totalAttendance?: string;
  averageParticipation?: string;
  responses?: string;
  insightTitle: string;
  insightBody: string;
  actions: Array<{ title: string; body: string }>;
  dashboardUrl: string;
};

export function renderWeeklyCourseDigestEmail(input: WeeklyCourseDigestInput): ClassfullyEmail {
  const metrics: EmailMetric[] = [
    { label: 'Sessions', value: input.sessionsRun, note: 'completed', color: 'violet' },
  ];
  if (isTrackedMetric(input.totalAttendance)) metrics.push({ label: 'Attendance', value: input.totalAttendance, note: 'seats across sessions', color: 'green' });
  if (isTrackedMetric(input.averageParticipation)) metrics.push({ label: 'Participation', value: input.averageParticipation, note: 'weekly average', color: 'gold' });
  if (isTrackedMetric(input.responses)) metrics.push({ label: 'Responses', value: input.responses, note: 'shared this week', color: 'coral' });

  return renderClassfullyEmail({
    subject: 'Your Classfully week, at a glance',
    previewText: 'See how attendance and participation added up across the classes you taught this week.',
    eyebrow: 'Weekly summary',
    title: 'Your week, at a glance.',
    intro: 'here is what happened across the classes you taught this week.',
    recipientName: input.recipientName,
    periodLabel: input.weekLabel,
    metrics,
    insightTitle: input.insightTitle,
    insightBody: input.insightBody,
    actions: input.actions,
    ctaLabel: 'Open your teaching review',
    ctaUrl: input.dashboardUrl,
    closingNote: 'You will only receive this digest after a week with a finished class.',
  });
}

export type ProductNewsEmailInput = {
  recipientName: string;
};

export function renderProductNewsEmail(input: ProductNewsEmailInput): ClassfullyEmail {
  return renderClassfullyEmail({
    subject: 'A clearer way to build your session plan',
    previewText: 'Save activities once, then add them to any session.',
    eyebrow: 'What is new in Classfully',
    title: 'Save it once. Use it when it fits.',
    intro: 'your activities now live in one library. Add them to any session without rebuilding them.',
    recipientName: input.recipientName,
    periodLabel: 'Product note',
    metrics: [],
    insightLabel: 'How it works',
    insightTitle: 'Your class stays in control.',
    insightBody: 'The library stores reusable activities. You still choose what students see in each session.',
    actions: [
      { title: 'Save what works', body: 'Keep useful prompts, case studies, and modules in the library.' },
      { title: 'Add what this class needs', body: 'Choose the activities that belong in the current session.' },
    ],
    ctaLabel: 'Open your activity library',
    ctaUrl: `${CLASSFULLY_URL}/dashboard/library`,
    closingNote: 'Product notes are occasional and separate from your teaching reports.',
    privacyNote: 'You opted in to occasional Classfully product notes. You can turn them off in Email reports.',
  });
}

export type PasswordResetEmailInput = {
  recipientName: string;
};

export function renderPasswordResetEmail(input: PasswordResetEmailInput): ClassfullyEmail {
  return renderClassfullyEmail({
    subject: 'Reset your Classfully password',
    previewText: 'Use this secure link to choose a new password.',
    eyebrow: 'Password reset',
    title: 'Choose a new password.',
    intro: 'we received a request to reset your password.',
    recipientName: input.recipientName,
    periodLabel: 'Account security',
    metrics: [],
    insightLabel: 'Security check',
    insightTitle: 'Did you request this?',
    insightBody: 'If not, you can ignore this email. Your password will stay the same.',
    actions: [],
    ctaLabel: 'Reset password',
    ctaUrl: `${CLASSFULLY_URL}/login?mode=reset&code=preview`,
    closingNote: 'Classfully will never ask you to send your password by email.',
    privacyNote: 'This security email was requested for your Classfully instructor account.',
  });
}

export const classfullyEmailPreviewSamples = {
  welcome: renderWelcomeEmail({
    recipientName: 'Maya',
  }),
  teachingTeamWelcome: renderTeachingTeamWelcomeEmail({
    recipientName: 'Ari',
    role: 'co-instructor',
    scope: 'course',
    courseName: 'Intermediate Microeconomics',
    courseCode: 'ECON 302',
    ctaUrl: `${CLASSFULLY_URL}/dashboard/classes/course-preview`,
  }),
  afterClass: renderAfterClassReportEmail({
    recipientName: 'Maya',
    courseCode: 'ECON 302',
    courseName: 'Intermediate Microeconomics',
    sessionTitle: 'Week 6: Platform strategy',
    sessionDate: 'August 11, 2026',
    attendance: '102',
    participation: '99%',
    responses: '567',
    confidence: undefined,
    openQuestions: '9',
    insightTitle: 'The room understands direct effects. Indirect effects need another pass.',
    insightBody: 'Confidence grew during the worked example, while the most-upvoted questions focused on fragility and platform dependence.',
    actions: [
      { title: 'Revisit indirect network effects', body: 'Start with one concrete example before moving to the next concept.' },
      { title: 'Bring 3 questions into the next discussion', body: 'Students have already surfaced the points they want unpacked.' },
    ],
    dashboardUrl: `${CLASSFULLY_URL}/dashboard/review`,
  }),
  weeklyDigest: renderWeeklyCourseDigestEmail({
    recipientName: 'Maya',
    weekLabel: 'Week of August 10',
    sessionsRun: '3',
    totalAttendance: '286',
    averageParticipation: '88%',
    responses: '740',
    insightTitle: 'More of the room is contributing, and confidence is following.',
    insightBody: 'Participation widened across all three sessions. Students who checked in consistently were also more likely to attempt the quiz.',
    actions: [
      { title: 'Keep the opening pulse', body: 'It is giving quieter students an easy first contribution.' },
      { title: 'Build on the platform strategy questions', body: 'The same theme appeared in two sessions and is ready for a deeper discussion.' },
    ],
    dashboardUrl: `${CLASSFULLY_URL}/dashboard/progress`,
  }),
  productNews: renderProductNewsEmail({
    recipientName: 'Maya',
  }),
  passwordReset: renderPasswordResetEmail({
    recipientName: 'Maya',
  }),
} as const;
