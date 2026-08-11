export type BlogCategory =
  | 'Classroom practice'
  | 'Student participation'
  | 'Course progress'
  | 'Tools and comparisons';

export type BlogCalloutTone = 'violet' | 'mint' | 'sun' | 'coral';

export type BlogBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: Array<{ title: string; body: string }> }
  | { type: 'callout'; eyebrow?: string; title: string; body: string; tone: BlogCalloutTone }
  | { type: 'quote'; quote: string; attribution?: string }
  | {
      type: 'table';
      caption?: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: 'cta';
      eyebrow?: string;
      title: string;
      body: string;
      label: string;
      href: string;
      tone: BlogCalloutTone;
    };

export type BlogSection = {
  id: string;
  title: string;
  eyebrow?: string;
  blocks: BlogBlock[];
};

export type BlogPost = {
  status: 'draft' | 'published';
  slug: string;
  title: string;
  description: string;
  dek: string;
  category: BlogCategory;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  author: {
    name: string;
    role: string;
  };
  featuredImage: string;
  featuredImageAlt: string;
  featured?: boolean;
  primaryKeyword: string;
  secondaryKeywords: string[];
  signal: {
    problem: string;
    classroomMoment: string;
    nextSession: string;
  };
  takeaway: string;
  sections: BlogSection[];
  relatedSlugs: string[];
};
