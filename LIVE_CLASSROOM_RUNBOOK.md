# Live classroom runbook

Use this checklist before every session until the pilot has completed several reliable classes.

## One week before the pilot

- Put the Firebase project on the Blaze plan. A 100 to 200 person class cannot use the Spark Realtime Database connection limit.
- Ask Firebase support for an anonymous account-creation quota that is safely above the class size. Students on one university network may share one public IP address.
- Deploy `firestore.rules` and `database.rules.json` to `interactive-case-study-2aff7` from an account that has access to that project.
- Deploy the Next.js app to a public HTTPS host. The old static Firebase Hosting configuration has been removed because it cannot run the AI API routes.
- Set the production environment variables, including the final public URL, controller name, and privacy contact.
- Run `npm run ready:classroom`. Do not invite students while it reports a blocker.

## Thirty minutes before class

1. Open the prepared session from the instructor dashboard.
2. Open the classroom display and move it to the projector.
3. Confirm the instructor screen says **Display connected**.
4. Scan the projector QR code on a separate phone using mobile data, not the instructor laptop.
5. Enter a test student number, acknowledge the privacy notice, and submit one pulse and one quiz answer.
6. Confirm the instructor count and projector count both change.
7. Refresh the student phone and projector. Confirm both reconnect to the same activity.
8. Keep the slide deck open in its normal presentation app and practise switching to the classroom display.
9. Set `REAL_DEVICE_E2E_CONFIRMED=true` only after this exact deployed build passes the checks above, then rerun `npm run ready:classroom`.

## During class

- Keep the instructor console and classroom display open in separate windows.
- Wait for the display connection indicator before launching an interaction.
- For written responses, share only responses you have read first.
- Treat wellbeing check-ins as optional. Do not use them for grades, rewards, discipline, or attendance.
- Attendance is a student claim, not verified identity. Review duplicates before using the export.

## Recovery

- **Projector is stale:** reload the display window. It should recover the current state from Firebase.
- **Student count stops moving:** check internet access and the Firebase status page. Pause the interaction while reconnecting.
- **Pop-up blocked:** copy the display URL into a new browser window and move it to the projector.
- **AI drafting is unavailable:** teach from the already prepared questions. AI generation is never required during class.
- **Firebase is unavailable:** return to the slide deck and use verbal or show-of-hands prompts. Do not keep students waiting on a broken join screen.

## After class

- End the session so the join code no longer accepts students.
- Review attendance claims and unanswered questions.
- Delete test sessions and any accidental student data.
- Record failures, approximate affected students, device types, and recovery time before the next pilot.
