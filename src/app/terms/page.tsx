import LegalDocument from '@/components/marketing/LegalDocument';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Terms & Conditions',
  description: 'The terms and shared responsibilities that apply when instructors, institutions, students, and visitors use Classfully.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms & Conditions"
      title="The shared rules for using Classfully."
      intro="These terms apply to instructors, institutions, students, and visitors who access Classfully. They are written to keep classroom participation useful, fair, and safe."
    >
      <section>
        <h2>1. Accepting these terms</h2>
        <p>By accessing or using Classfully, you agree to these terms and the applicable Data Policy and student privacy notice. If you use Classfully for an institution, you confirm that you have authority to accept these terms for that institution or that an authorized person has approved its use.</p>
      </section>

      <section>
        <h2>2. The service</h2>
        <p>Classfully provides tools for classroom check-ins, attendance, polls, quizzes, discussions, questions, case studies, progress, points, and instructor-approved rewards. Features may change as the platform develops. Pilot or preview features may be less stable and will be identified where practical.</p>
      </section>

      <section>
        <h2>3. Accounts and access</h2>
        <p>Instructors are responsible for protecting their account credentials and for the activity performed through their accounts. Students must use only the class code and identity information assigned to them. Users must not impersonate another person, share restricted access, or attempt to bypass response limits or attendance checks.</p>
      </section>

      <section>
        <h2>4. Instructor and institution responsibilities</h2>
        <ul>
          <li>Use Classfully only for legitimate teaching, learning, and course administration.</li>
          <li>Give students an appropriate privacy notice and choose a valid legal basis for required classroom processing.</li>
          <li>Keep optional wellbeing or sentiment prompts separate from grades, discipline, public rankings, and compulsory attendance.</li>
          <li>Review AI-generated material before presenting or grading it.</li>
          <li>Use points, extra credit, passes, or other rewards consistently and in line with institutional policy.</li>
          <li>Do not upload personal data that is unnecessary for the classroom activity.</li>
        </ul>
      </section>

      <section>
        <h2>5. Student responsibilities</h2>
        <p>Students must participate honestly, respect classmates, and avoid abusive, discriminatory, threatening, unlawful, or intentionally disruptive submissions. Classfully may allow anonymous classroom display, but instructors can access records needed to manage the course and respond to misuse.</p>
      </section>

      <section>
        <h2>6. Points, leaderboards, and rewards</h2>
        <p>Classfully points have no cash value and cannot be transferred outside the course. Any academic reward, extra credit, deadline pass, or exam accommodation is offered and approved by the instructor or institution, not guaranteed by Classfully. Institutions are responsible for fairness, accessibility, and compliance with their academic rules.</p>
      </section>

      <section>
        <h2>7. Content and intellectual property</h2>
        <p>Users retain ownership of lesson materials, questions, responses, and other content they submit, subject to any rights held by their institution. Users give Classfully the limited permission needed to host, process, display, and transmit that content to provide the service.</p>
        <p>Users must have the right to upload their content and must not submit material that infringes copyright, privacy, confidentiality, or other rights. Classfully&apos;s name, branding, interface, and platform software remain protected by applicable intellectual property law.</p>
      </section>

      <section>
        <h2>8. Acceptable use</h2>
        <p>You must not probe or disrupt the service, introduce malicious code, scrape restricted information, reverse engineer protected parts of the platform, access another user&apos;s data without permission, use the service for surveillance or harassment, or use automated systems in a way that harms reliability for others.</p>
      </section>

      <section>
        <h2>9. Privacy and data</h2>
        <p>The Data Policy and student privacy notice explain how information is handled. An institution may have an additional notice or agreement that applies to its classroom. If those documents conflict, mandatory law and the institution&apos;s controller obligations still apply.</p>
      </section>

      <section>
        <h2>10. Availability and changes</h2>
        <p>Classfully aims to provide a reliable service but does not promise uninterrupted or error-free availability. Maintenance, provider outages, classroom connectivity, or feature changes may affect access. Instructors should keep a practical backup for attendance and high-stakes assessments.</p>
      </section>

      <section>
        <h2>11. Suspension and termination</h2>
        <p>Access may be limited or suspended when reasonably necessary to protect users, investigate misuse, comply with law, or secure the service. Users may stop using Classfully at any time. Instructors should export or preserve records their institution is required to retain before deleting an account or course.</p>
      </section>

      <section>
        <h2>12. Disclaimers and responsibility</h2>
        <p>Classfully supports classroom decisions but does not replace instructor judgment, institutional policy, accessibility review, academic integrity procedures, or professional advice. To the extent permitted by law, the service is provided as available and without warranties that cannot reasonably be given for an evolving online platform.</p>
        <p>To the extent permitted by law, Classfully is not responsible for indirect or consequential loss caused by use of the service. Nothing in these terms excludes responsibility that cannot legally be excluded.</p>
      </section>

      <section>
        <h2>13. Governing law</h2>
        <p>Unless mandatory law requires otherwise, these terms are governed by the laws of Thailand. Before starting formal proceedings, the parties should first try to resolve the issue in good faith through the contact below.</p>
      </section>

      <section>
        <h2>14. Changes to these terms</h2>
        <p>Updated terms will be published on this page with a revised effective date. Continued use after an update means the new terms apply, except where additional consent or notice is required by law.</p>
      </section>
    </LegalDocument>
  );
}
