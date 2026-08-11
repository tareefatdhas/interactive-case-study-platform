'use strict';

function objectValues(value) {
  return value && typeof value === 'object' ? Object.values(value) : [];
}

function countNestedResponses(responseRuns) {
  return objectValues(responseRuns).reduce((total, run) => total + objectValues(run).length, 0);
}

function collectNestedKeys(responseRuns, target) {
  objectValues(responseRuns).forEach((run) => {
    if (!run || typeof run !== 'object') return;
    Object.keys(run).forEach((studentId) => target.add(studentId));
  });
}

function collectLiveRoomData(liveRoom = {}) {
  const participants = new Set();
  collectNestedKeys(liveRoom.responses, participants);
  collectNestedKeys(liveRoom.welcomeResponses, participants);
  Object.keys(liveRoom.studentQuestions || {}).forEach((studentId) => participants.add(studentId));

  let responseCount = countNestedResponses(liveRoom.responses) + countNestedResponses(liveRoom.welcomeResponses);
  const questions = {};
  objectValues(liveRoom.studentQuestions).forEach((studentQuestions) => {
    objectValues(studentQuestions).forEach((question) => {
      if (question && question.id !== undefined) questions[String(question.id)] = question;
    });
  });

  objectValues(liveRoom.archives).forEach((archive) => {
    if (!archive || typeof archive !== 'object') return;
    collectNestedKeys(archive.responses, participants);
    collectNestedKeys(archive.welcomeResponses, participants);
    responseCount += countNestedResponses(archive.responses) + countNestedResponses(archive.welcomeResponses);
    objectValues(archive.studentQuestions).forEach((studentQuestions) => {
      objectValues(studentQuestions).forEach((question) => {
        if (question && question.id !== undefined) questions[String(question.id)] = question;
      });
    });
  });

  const dismissed = { ...(liveRoom.dismissedQuestions || {}) };
  const recognized = { ...(liveRoom.recognizedQuestions || {}) };
  objectValues(liveRoom.archives).forEach((archive) => {
    if (!archive || typeof archive !== 'object') return;
    Object.assign(dismissed, archive.dismissedQuestions || {});
    Object.assign(recognized, archive.recognizedQuestions || {});
  });

  const openQuestions = Object.keys(questions).filter((questionId) => !dismissed[questionId] && !recognized[questionId]).length;
  return { participants, responseCount, openQuestions };
}

function collectSessionMetrics({ session = {}, liveRoom = {}, legacyResponses = [] }) {
  const live = collectLiveRoomData(liveRoom);
  const attendanceClaims = objectValues(liveRoom.attendanceClaims);
  const attendance = attendanceClaims.length || (Array.isArray(session.studentsJoined) ? session.studentsJoined.length : 0);

  const legacyParticipants = new Set(legacyResponses.map((response) => response.studentId).filter(Boolean));
  const participantCount = live.participants.size || legacyParticipants.size;
  const responseCount = live.responseCount || legacyResponses.length;
  const participationRate = attendance > 0 ? Math.min(100, Math.round((participantCount / attendance) * 100)) : null;

  const metrics = [];
  if (attendance > 0) metrics.push({ label: 'Attendance', value: String(attendance), note: 'students present', color: 'green' });
  if (participationRate !== null) metrics.push({ label: 'Participation', value: `${participationRate}%`, note: 'contributed', color: 'violet' });
  if (responseCount > 0) metrics.push({ label: 'Responses', value: String(responseCount), note: 'shared in class', color: 'gold' });
  if (live.openQuestions > 0) metrics.push({ label: 'Questions', value: String(live.openQuestions), note: 'still open', color: 'coral' });

  let insightTitle = 'The session is now part of the course record.';
  if (participationRate !== null && participationRate >= 80) insightTitle = 'Most of the room found a way to contribute.';
  else if (participationRate !== null && participationRate >= 50) insightTitle = 'More than half of the room contributed.';
  else if (participationRate !== null) insightTitle = 'Participation was concentrated in part of the room.';

  const insightParts = [];
  if (participantCount > 0 && attendance > 0) insightParts.push(`${participantCount} of ${attendance} students submitted at least one response.`);
  if (responseCount > 0) insightParts.push(`Together, they shared ${responseCount} responses.`);
  if (live.openQuestions > 0) insightParts.push(`${live.openQuestions} student question${live.openQuestions === 1 ? ' remains' : 's remain'} open.`);

  const actions = [];
  if (live.openQuestions > 0) actions.push({
    title: 'Bring the open questions forward',
    body: 'Start the next session with the questions students are still waiting to discuss.',
  });
  if (participationRate !== null && participationRate < 70) actions.push({
    title: 'Give the room an easier first response',
    body: 'An arrival pulse or low-stakes poll can help more students contribute early.',
  });
  if (!actions.length) actions.push({
    title: 'Keep the opening interaction',
    body: 'The room participated broadly. Reuse a quick opening moment to help that pattern continue.',
  });

  return {
    attendance,
    participantCount,
    participationRate,
    responseCount,
    openQuestions: live.openQuestions,
    metrics,
    insightTitle,
    insightBody: insightParts.join(' ') || 'Open the session review to see what the room shared.',
    actions,
  };
}

function collectWeeklyMetrics(sessionReports) {
  const sessions = sessionReports.length;
  const courses = new Set(sessionReports.map((report) => report.courseId || report.courseCode).filter(Boolean));
  const totalAttendance = sessionReports.reduce((sum, report) => sum + report.attendance, 0);
  const totalResponses = sessionReports.reduce((sum, report) => sum + report.responseCount, 0);
  const rates = sessionReports.map((report) => report.participationRate).filter((rate) => rate !== null);
  const averageParticipation = rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null;
  const openQuestions = sessionReports.reduce((sum, report) => sum + report.openQuestions, 0);

  const metrics = [
    { label: 'Sessions', value: String(sessions), note: 'completed', color: 'violet' },
  ];
  if (totalAttendance > 0) metrics.push({ label: 'Attendance', value: String(totalAttendance), note: 'seats across sessions', color: 'green' });
  if (averageParticipation !== null) metrics.push({ label: 'Participation', value: `${averageParticipation}%`, note: 'weekly average', color: 'gold' });
  if (totalResponses > 0) metrics.push({ label: 'Responses', value: String(totalResponses), note: 'shared this week', color: 'coral' });

  const insightTitle = averageParticipation !== null && averageParticipation >= 80
    ? 'Participation stayed broad across the week.'
    : 'The week now has a pattern you can build on.';
  const insightBody = [
    `${sessions} session${sessions === 1 ? '' : 's'} across ${Math.max(courses.size, 1)} course${courses.size === 1 ? '' : 's'} added to the record.`,
    averageParticipation !== null ? `Average participation was ${averageParticipation}%.` : '',
    openQuestions > 0 ? `${openQuestions} question${openQuestions === 1 ? ' remains' : 's remain'} open.` : '',
  ].filter(Boolean).join(' ');

  const actions = openQuestions > 0
    ? [{ title: 'Review what is still open', body: 'Bring unresolved student questions into the next class plan.' }]
    : [{ title: 'Plan from the pattern', body: 'Use the course review to decide which interaction is worth repeating next week.' }];

  return { metrics, insightTitle, insightBody, actions };
}

module.exports = {
  collectSessionMetrics,
  collectWeeklyMetrics,
};
