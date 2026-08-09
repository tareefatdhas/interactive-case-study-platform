# PDPA readiness for Classfully

Status: pilot safeguards implemented, institutional review still required.

This document is an engineering and product checklist. It is not legal advice or a certification of compliance. The university deploying the platform must confirm its lawful bases, privacy contact, retention schedule, processor agreements, and international-transfer safeguards.

## Roles

- The university or instructor operating a class is the data controller. It decides why attendance and classroom information are used.
- Classfully is a data processor when it handles that information only to provide the classroom service.
- Firebase and the configured AI provider are subprocessors. Their region, retention, training, and contract settings must be reviewed before the pilot.

## Data inventory

| Data | Purpose | Visibility | Current storage |
| --- | --- | --- | --- |
| Student number | Attendance and course progress | Instructor only | Firebase Realtime Database attendance claim |
| Temporary Firebase UID | One response per activity and presence | System and instructor data path | Firebase Authentication and Realtime Database |
| Poll, quiz, and written responses | Run the lesson and review understanding | Instructor; projector only when deliberately shared | Realtime Database |
| Wellbeing pulse | Adjust pace or teaching support | Instructor can access individual records; projector receives totals | Realtime Database |
| Question votes | Prioritise classroom questions | Instructor and the student who voted | Realtime Database |
| Reward ledger | Student feedback and course rewards | Student device | Browser local storage in the current pilot |
| Instructor lesson material | Draft interaction questions | Instructor and configured AI provider | Sent in the generation request; not added to student data |

## Product safeguards now implemented

- Student number collection includes a versioned privacy acknowledgement.
- A student privacy notice is available before joining and from the student view.
- Projector views do not show student numbers or individual wellbeing answers.
- AI question drafting warns instructors not to upload names, student numbers, grades, health information, or private submissions.
- Student response data is not included in AI question-generation requests.
- Deleting a standalone session also deletes its live room, attendance claims, responses, wellbeing entries, votes, presence records, and join code.
- Wellbeing prompts include “Prefer not to say” and must not affect grades, points, rewards, attendance, or leaderboards.
- Reduced-motion preferences disable the new reward animation and haptic acknowledgement.

## Lawful-basis decisions required from the institution

Do not treat a required classroom checkbox as freely given consent.

- Attendance and course participation should use the lawful basis selected by the institution for teaching administration, such as public task, contract, legal obligation, or a documented legitimate interest.
- Wellbeing information may reveal health-related information and requires a separate Section 26 analysis. Make it optional and obtain explicit consent where that is the selected basis, or redesign it so the result cannot be linked back to a student.
- AI processing must be limited to teaching material. A separate review is required before any student data is sent to an AI provider.

## Retention

Pilot target: delete live classroom and attendance data within 90 days after the course ends, unless the institution documents a shorter period or a legal obligation to keep a specific record longer.

Current enforcement:

- An instructor can delete a session and its live data immediately.
- Automatic time-based deletion is not yet implemented. Production deployment requires a scheduled server-side retention job and an auditable deletion log.
- Local reward data stays on the student's device until browser storage is cleared. A visible reset/export control should be added before rewards are used for formal credit.

## Student rights workflow

The institution must publish a verified contact route for access, correction, deletion, restriction, objection, portability, and withdrawal requests.

1. The student contacts the institution or instructor privacy contact.
2. The institution verifies identity. A student number by itself is not sufficient authentication.
3. The instructor locates the class and session records.
4. The request and completion date are logged.
5. The institution responds within the deadline required by Thai PDPA and its applicable notifications.

Cross-device self-service rights require verified student accounts. LINE Login or another institution-approved identity provider is the planned pilot path.

## Security and breach readiness

- Deploy the reviewed Firestore and Realtime Database rules before the pilot.
- Restrict production Firebase projects and AI keys to approved environments.
- Enable provider audit logs, least-privilege administration, encryption in transit, backups, and documented restore testing.
- Maintain a data breach procedure and a named privacy contact. The PDPC's GPPC platform includes breach, consent, processing-record, and data-subject-request workflows.
- The local Firestore rule set now scopes legacy student, response, progress, and achievement records to the signed-in device identity. Deploy and test those rules before using the legacy module. Formal attendance still requires an instructor-verified student number or another approved identity process.

## Production release gates

- [ ] Institution legal name and privacy contact added to the student notice
- [ ] Lawful basis recorded for attendance, responses, rewards, and wellbeing
- [ ] Explicit wellbeing choice or unlinkable aggregate design approved
- [ ] Firebase region and cross-border safeguards approved
- [ ] Firebase and AI data-processing terms approved
- [ ] Realtime Database and Firestore rules deployed and tested
- [ ] Automatic retention job and deletion audit log enabled
- [ ] Verified student identity enabled for cross-device access and rights requests
- [ ] Local owner-scoped Firestore rules deployed and verified against the legacy module
- [ ] Incident-response owner and PDPC notification process documented
- [ ] Real-device testing completed on iOS and Android
