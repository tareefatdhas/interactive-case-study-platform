import { DEFAULT_DESCRIPTION, SITE_URL } from '@/lib/metadata';

const faqItems = [
  ['Do I need to move my slides into Classfully?', 'No. Keep your presentation where it is. Open Classfully when students should respond.'],
  ['What does a student need?', 'A phone, tablet, or laptop, plus the class code and their student number. There is no app to install.'],
  ['What appears on the projector?', 'Only class totals and responses you choose. Student IDs, private questions, and personal pulse answers stay hidden.'],
  ['Can I ask something I did not prepare?', 'Yes. Launch a pulse, poll, quiz, or short response from the instructor console.'],
  ['What continues after class?', 'Attendance, participation, quiz results, questions, and reflections stay with the course. Students see personal progress. Instructors see class patterns.'],
  ['Can points become course rewards?', 'Yes, if they fit the course and university policy. Instructors approve every academic reward.'],
] as const;

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Classfully',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/apple-icon.png`,
        width: 180,
        height: 180,
      },
      email: 'mailto:tareef@happily.ai',
      founder: {
        '@type': 'Person',
        name: 'Tareef Jafferi',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Classfully',
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#application`,
      name: 'Classfully',
      applicationCategory: 'EducationalApplication',
      applicationSubCategory: 'Classroom engagement platform',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      featureList: [
        'Live classroom polls, quizzes, check-ins, and short responses',
        'Instructor console and separate projector display',
        'Attendance and participation records across class sessions',
        'Student questions, voting, and moderated discussion',
        'Student progress, points, streaks, and instructor-approved rewards',
        'Course-level confidence and participation trends',
      ],
      provider: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: faqItems.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
        },
      })),
    },
  ],
};

export default function HomeJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
      }}
    />
  );
}
