import LegalDocument from '@/components/marketing/LegalDocument';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Data Policy',
  description: 'How Classfully collects, uses, shares, retains, and protects instructor, student, platform, and classroom information.',
  path: '/data-policy',
});

export default function DataPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Data Policy"
      title="What we collect, and why."
      intro="This policy explains how Classfully handles information across the public website, instructor accounts, live classroom sessions, student progress, and support requests."
    >
      <section>
        <h2>1. Who is responsible for the data</h2>
        <p>Classfully is operated by Tareef Jafferi. For website visits, instructor accounts, platform administration, and support requests, Classfully normally decides why and how personal data is used.</p>
        <p>For classroom records, the instructor or educational institution normally decides why the information is collected and acts as the data controller. Classfully processes that information to provide the service. Institutions remain responsible for choosing a lawful basis, telling students how classroom data will be used, and setting appropriate course policies.</p>
      </section>

      <section>
        <h2>2. Information Classfully may process</h2>
        <ul>
          <li><strong>Instructor information:</strong> name, email address, account identifiers, course details, lesson material, interaction plans, and support messages.</li>
          <li><strong>Student identity information:</strong> student number, optional preferred name, class membership, temporary authentication identifier, and device or session identifiers used to prevent duplicate responses.</li>
          <li><strong>Classroom activity:</strong> attendance, poll and quiz responses, written responses, questions, votes, check-ins, points, streaks, rewards, and timestamps.</li>
          <li><strong>Optional pulse information:</strong> pace, confidence, sentiment, or wellbeing responses. These prompts should remain optional and must not be used for grading or discipline.</li>
          <li><strong>Technical information:</strong> browser, device, IP address, security events, diagnostic logs, and service usage needed to operate and protect the platform.</li>
        </ul>
      </section>

      <section>
        <h2>3. How information is used</h2>
        <p>Information is used to authenticate users, run live activities, record attendance, preserve course progress, show class-level results, calculate instructor-approved points or rewards, provide support, maintain security, improve reliability, and meet legal obligations.</p>
        <p>Classfully does not sell student personal data. Individual student numbers and personal pulse responses are not shown on the classroom projector. Instructors choose when an anonymous written response is shared with the room.</p>
      </section>

      <section>
        <h2>4. Browser storage and essential cookies</h2>
        <p>Classfully uses browser storage and essential cookies to keep users signed in, remember a student between class sessions, preserve accessibility preferences, synchronize the instructor and classroom display, and keep pilot reward progress on the student&apos;s device.</p>
        <p>The remembered-student cookie is currently set for up to 30 days. Some local browser records remain until they are cleared by the user or removed by the platform. Classfully does not currently use advertising cookies or third-party advertising trackers.</p>
      </section>

      <section>
        <h2>5. AI-assisted question drafting</h2>
        <p>When an instructor asks Classfully to draft interactions, the lesson material they provide may be sent to the configured AI provider. Instructors must not upload student names, student numbers, grades, health information, private submissions, or other unnecessary personal data for this purpose.</p>
        <p>Student attendance, classroom responses, pulse answers, and reward records are not intentionally included in question-generation requests.</p>
      </section>

      <section>
        <h2>6. Service providers and international processing</h2>
        <p>Classfully currently relies on service providers including Vercel for application hosting and delivery, and Google services such as Firebase for authentication and classroom storage and Gemini for instructor-requested question drafting. These providers may process information outside Thailand.</p>
        <p>Classfully and participating institutions should use appropriate contractual, technical, and organizational safeguards for cross-border processing. A current provider list or institutional data-processing information can be requested by email.</p>
      </section>

      <section>
        <h2>7. Retention and deletion</h2>
        <p>Classroom data should be kept only for the period set by the instructor or institution. The current pilot target is deletion within 90 days after the course ends unless a shorter period is chosen or a legal obligation requires longer retention.</p>
        <p>Instructors can delete a session and its associated live attendance, response, vote, and presence records. Classfully also runs a daily cleanup that removes live classroom data 90 days after its last recorded update.</p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>Classfully uses access controls, authenticated services, encrypted connections, restricted classroom views, and database rules intended to limit information to the people and systems that need it. No online service can promise absolute security. Suspected unauthorized access should be reported promptly to the contact below.</p>
      </section>

      <section>
        <h2>9. Your choices and rights</h2>
        <p>Depending on the applicable law, you may ask to access, correct, delete, restrict, object to, or receive a portable copy of your personal data, and you may withdraw consent where consent is the basis used. Classroom requests may need to be handled with the instructor or institution so the correct record can be found and identity can be verified.</p>
        <p>You may decline optional pulse or wellbeing questions without losing access to ordinary classroom activities. You may also raise a complaint with the appropriate data protection authority, including <a href="https://www.pdpc.or.th/">Thailand&apos;s Personal Data Protection Committee</a> where applicable.</p>
      </section>

      <section>
        <h2>10. Minors and institutional use</h2>
        <p>Classfully is designed primarily for university and adult-learning settings. If an institution uses it with a person who cannot provide valid consent under applicable law, the institution is responsible for the required authorization and age-appropriate notice.</p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>Material changes will be published on this page with a revised effective date. If a change significantly affects classroom information already collected, Classfully will provide additional notice where reasonably possible.</p>
      </section>
    </LegalDocument>
  );
}
