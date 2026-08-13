'use strict';

const CLASSFULLY_URL = 'https://classfully.com';
const CLASSFULLY_MARK_URL = `${CLASSFULLY_URL}/icon.svg`;
const MANAGE_EMAIL_URL = `${CLASSFULLY_URL}/dashboard/settings#email-reports`;

const COLORS = {
  violet: { foreground: '#5146e5', background: '#eeecff' },
  green: { foreground: '#25804a', background: '#e8f7ed' },
  gold: { foreground: '#9a6a00', background: '#fff3c9' },
  coral: { foreground: '#b84f3d', background: '#ffebe6' },
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value) {
  try {
    const url = new URL(value, CLASSFULLY_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? escapeHtml(url.toString()) : CLASSFULLY_URL;
  } catch {
    return CLASSFULLY_URL;
  }
}

function renderMetric(metric, count) {
  const color = COLORS[metric.color] || COLORS.violet;
  const width = `${100 / Math.max(count, 1)}%`;
  return `<td class="metric" width="${width}" valign="top" style="width:${width};padding:0 6px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${color.background};border-radius:14px;">
      <tr><td style="padding:16px 14px 15px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;line-height:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#697087;">${escapeHtml(metric.label)}</div>
        <div style="padding-top:7px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:32px;font-weight:700;color:${color.foreground};">${escapeHtml(metric.value)}</div>
        <div style="padding-top:4px;font-family:Arial,sans-serif;font-size:12px;line-height:17px;color:#697087;">${escapeHtml(metric.note)}</div>
      </td></tr>
    </table>
  </td>`;
}

function renderAction(action, index) {
  return `<tr>
    <td width="38" valign="top" style="padding:12px 12px 12px 0;"><div style="width:30px;height:30px;border-radius:50%;background:#eeecff;font-family:Arial,sans-serif;font-size:13px;line-height:30px;font-weight:700;text-align:center;color:#5146e5;">${index + 1}</div></td>
    <td valign="top" style="padding:12px 0;border-bottom:1px solid #e3e5ed;">
      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:21px;font-weight:700;color:#101a38;">${escapeHtml(action.title)}</div>
      <div style="padding-top:3px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#697087;">${escapeHtml(action.body)}</div>
    </td>
  </tr>`;
}

function renderEmail(input) {
  const metrics = (input.metrics || []).filter((metric) => metric && metric.value !== undefined && metric.value !== null && String(metric.value).trim());
  const metricsHtml = metrics.length
    ? `<tr><td class="pad" style="padding:0 30px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${metrics.map((metric) => renderMetric(metric, metrics.length)).join('')}</tr></table></td></tr>`
    : '';
  const actions = (input.actions || []).filter(Boolean);
  const actionsHtml = actions.length
    ? `<tr><td class="pad" style="padding:6px 36px 14px;"><div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5146e5;">Next steps</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${actions.map(renderAction).join('')}</table></td></tr>`
    : '';
  const insightHtml = input.insightTitle
    ? `<tr><td class="pad" style="padding:12px 36px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eaf7ef;border-radius:16px;"><tr><td style="padding:18px 20px;"><div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#25804a;">${escapeHtml(input.insightLabel || 'What stands out')}</div><div style="padding-top:7px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;color:#101a38;">${escapeHtml(input.insightTitle)}</div><div style="padding-top:7px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#4f6858;">${escapeHtml(input.insightBody || '')}</div></td></tr></table></td></tr>`
    : '';
  const contextHtml = input.contextTitle
    ? `<tr><td class="pad" style="padding:24px 36px 16px;"><table role="presentation" width="100%"><tr><td class="course-code" style="font-family:Arial,sans-serif;font-size:13px;line-height:19px;font-weight:700;color:#101a38;">${escapeHtml(input.contextCode || '')}</td><td class="course-name" align="right" style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:21px;font-style:italic;color:#697087;">${escapeHtml(input.contextTitle)}</td></tr></table></td></tr>`
    : '';

  const text = [
    input.title,
    '',
    `Hi ${input.recipientName},`,
    input.intro,
    '',
    ...metrics.map((metric) => `${metric.label}: ${metric.value} (${metric.note})`),
    input.insightTitle ? `\n${input.insightTitle}\n${input.insightBody || ''}` : '',
    actions.length ? `\nNext steps:\n${actions.map((action, index) => `${index + 1}. ${action.title}: ${action.body}`).join('\n')}` : '',
    '',
    `${input.ctaLabel}: ${input.ctaUrl}`,
    '',
    `Manage email reports: ${MANAGE_EMAIL_URL}`,
  ].filter((line) => line !== '').join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(input.subject)}</title><style>@media only screen and (max-width:620px){.shell{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.metric{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}.course-code,.course-name{display:block!important;width:100%!important;text-align:left!important}.course-name{padding-top:4px!important}.headline{font-size:32px!important;line-height:36px!important}}</style></head>
  <body style="margin:0;padding:0;background:#f5f3ef;color:#101a38;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.previewText)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f3ef;"><tr><td align="center" style="padding:30px 12px;"><table class="shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#fffefa;border:1px solid #e3e5ed;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(16,26,56,.08);">
    <tr><td style="height:5px;background:#5146e5;background-image:linear-gradient(90deg,#f4c94e 0%,#df664e 36%,#5146e5 70%,#73c696 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="pad" style="padding:24px 36px 18px;"><table role="presentation" width="100%"><tr><td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><img src="${CLASSFULLY_MARK_URL}" width="30" height="30" alt="" style="display:block;width:30px;height:30px;border:0;"></td><td valign="middle" style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:28px;font-weight:700;color:#101a38;">Classfully<span style="color:#df664e;">.</span></td></tr></table></td><td align="right" valign="middle" style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#5146e5;">${escapeHtml(input.periodLabel || '')}</td></tr></table></td></tr>
    <tr><td class="pad" style="padding:18px 36px 30px;background:#f1efff;"><div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5146e5;">${escapeHtml(input.eyebrow)}</div><h1 class="headline" style="margin:9px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:42px;font-weight:700;letter-spacing:-.02em;color:#101a38;">${escapeHtml(input.title)}</h1><p style="margin:15px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:23px;color:#4f5871;">Hi ${escapeHtml(input.recipientName)}, ${escapeHtml(input.intro)}</p></td></tr>
    ${contextHtml}${metricsHtml}${insightHtml}${actionsHtml}
    <tr><td class="pad" style="padding:16px 36px 30px;"><table role="presentation"><tr><td style="border-radius:999px;background:#5146e5;box-shadow:0 7px 0 #3630a9;"><a href="${safeUrl(input.ctaUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,sans-serif;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;color:#fff;">${escapeHtml(input.ctaLabel)} &nbsp;→</a></td></tr></table>${input.closingNote ? `<p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#7c8294;">${escapeHtml(input.closingNote)}</p>` : ''}</td></tr>
    <tr><td class="pad" style="padding:20px 36px 24px;border-top:1px solid #e3e5ed;background:#faf9f6;"><p style="margin:0;font-family:Arial,sans-serif;font-size:11px;line-height:18px;color:#7c8294;">${escapeHtml(input.privacyNote || 'This report uses class-level totals. Student names and individual responses stay inside Classfully.')}</p><p style="margin:9px 0 0;font-family:Arial,sans-serif;font-size:11px;line-height:18px;color:#7c8294;">Classfully is operated by Tareef Jafferi. <a href="${MANAGE_EMAIL_URL}" style="color:#5146e5;text-decoration:underline;">Manage email reports</a> or contact <a href="mailto:tareef@happily.ai" style="color:#5146e5;text-decoration:underline;">tareef@happily.ai</a>.</p></td></tr>
  </table></td></tr></table></body></html>`;

  return { subject: input.subject, previewText: input.previewText, html, text };
}

function renderWelcomeEmail(input) {
  return renderEmail({
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

function renderTeachingTeamWelcomeEmail(input) {
  const isProgressViewer = input.role === 'progress-viewer';
  const isCourseScope = input.scope === 'course';
  const sharedSpace = isCourseScope ? input.courseName || 'the shared course' : 'the shared teaching workspace';
  return renderEmail({
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
    contextCode: isCourseScope ? input.courseCode || '' : '',
    contextTitle: isCourseScope ? input.courseName || '' : '',
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

function renderAfterClassReportEmail(input) {
  return renderEmail({
    subject: `${input.courseCode}: your class, at a glance`,
    previewText: `See what happened in ${input.courseCode} and what to revisit next.`,
    eyebrow: 'After-class summary',
    title: input.sessionTitle,
    intro: 'here is what happened today and what may need your attention next.',
    recipientName: input.recipientName,
    periodLabel: input.sessionDate,
    contextCode: input.courseCode,
    contextTitle: input.courseName,
    metrics: input.metrics,
    insightTitle: input.insightTitle,
    insightBody: input.insightBody,
    actions: input.actions,
    ctaLabel: 'Open the session review',
    ctaUrl: input.dashboardUrl,
    closingNote: 'Open the full review for responses, questions, and student records.',
  });
}

function renderWeeklyDigestEmail(input) {
  return renderEmail({
    subject: 'Your Classfully week, at a glance',
    previewText: 'See how attendance and participation added up across the classes you taught this week.',
    eyebrow: 'Weekly summary',
    title: 'Your week, at a glance.',
    intro: 'here is what happened across the classes you taught this week.',
    recipientName: input.recipientName,
    periodLabel: input.weekLabel,
    metrics: input.metrics,
    insightTitle: input.insightTitle,
    insightBody: input.insightBody,
    actions: input.actions,
    ctaLabel: 'Open your teaching review',
    ctaUrl: `${CLASSFULLY_URL}/dashboard/review`,
    closingNote: 'You will only receive this summary after a week with a finished class.',
  });
}

module.exports = {
  renderWelcomeEmail,
  renderTeachingTeamWelcomeEmail,
  renderAfterClassReportEmail,
  renderWeeklyDigestEmail,
};
