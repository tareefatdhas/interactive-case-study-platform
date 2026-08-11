import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpenText, ChartLineUp, ChalkboardTeacher, Path } from '@phosphor-icons/react/ssr';
import MarketingPage from '@/components/marketing/MarketingPage';
import BlogCard from '@/components/blog/BlogCard';
import { blogPosts, formatBlogDate, getAuthorInitials, getFeaturedBlogPost } from '@/content/blog';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Classfully Field Notes',
  description: 'Practical guides for making university classrooms interactive and helping student participation build across every session.',
  path: '/blog',
});

const tracks = [
  {
    icon: ChalkboardTeacher,
    label: 'In the room',
    title: 'Run interactions that improve the lesson',
    body: 'Check-ins, live questions, discussion, group work, and reflection for real university classrooms.',
  },
  {
    icon: Path,
    label: 'Across the course',
    title: 'Help participation build over time',
    body: 'Connect attendance, confidence, contribution, progress, and rewards from one session to the next.',
  },
  {
    icon: ChartLineUp,
    label: 'Choose the right tool',
    title: 'Understand what fits your teaching',
    body: 'Clear comparisons and practical decisions for instructors choosing classroom interaction tools.',
  },
];

export default function BlogIndexPage() {
  const featured = getFeaturedBlogPost();
  const remaining = blogPosts.filter((post) => post.slug !== featured.slug);

  return (
    <MarketingPage>
      <div className="blog-index">
        <section className="blog-index-hero">
          <div className="mx-auto max-w-7xl px-5 pb-14 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
            <div className="blog-index-intro">
              <p className="seminar-eyebrow">Classfully Field Notes</p>
              <h1 className="seminar-display">Teaching ideas that hold up in a real room.</h1>
              <p>Practical guidance for university instructors who want to hear from more students, understand the room, and carry what they learn into the next class.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <article className="blog-featured-card">
            <Link href={`/blog/${featured.slug}`} className="blog-featured-image seminar-focus" aria-label={`Read ${featured.title}`}>
              <Image src={featured.featuredImage} alt={featured.featuredImageAlt} fill priority sizes="(max-width: 960px) 100vw, 58vw" />
              <span>New field note</span>
            </Link>
            <div className="blog-featured-copy">
              <div className="blog-card-meta"><span>{featured.category}</span><span>{featured.readingMinutes} min read</span></div>
              <h2 className="seminar-display"><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
              <p>{featured.dek}</p>
              <div className="blog-featured-author">
                <span className="blog-author-monogram" aria-hidden="true">{getAuthorInitials(featured.author.name)}</span>
                <div><strong>{featured.author.name}</strong><span>{formatBlogDate(featured.publishedAt)}</span></div>
              </div>
              <Link href={`/blog/${featured.slug}`} className="marketing-button marketing-button-primary seminar-focus">
                Read the field note <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>

        <section className="blog-topic-tracks">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="blog-section-heading">
              <div><p className="seminar-eyebrow">Built around teaching decisions</p><h2 className="seminar-display">Find the idea you need next.</h2></div>
              <p>Each article starts with a classroom problem and ends with something you can try.</p>
            </div>
            <div className="blog-track-grid">
              {tracks.map(({ icon: Icon, label, title, body }) => (
                <article key={label}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  <h3 className="seminar-display">{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {remaining.length ? (
          <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="blog-section-heading"><div><p className="seminar-eyebrow">Latest</p><h2 className="seminar-display">More from Field Notes</h2></div></div>
            <div className="blog-card-grid">{remaining.map((post) => <BlogCard key={post.slug} post={post} />)}</div>
          </section>
        ) : null}

        <section className="blog-index-cta">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><BookOpenText aria-hidden="true" /><p className="seminar-eyebrow">Put the idea into practice</p><h2 className="seminar-display">Bring one useful interaction into your next class.</h2></div>
            <Link href="/signup" className="marketing-button marketing-button-primary marketing-button-large seminar-focus">Create your first interactive class <ArrowRight aria-hidden="true" /></Link>
          </div>
        </section>
      </div>
    </MarketingPage>
  );
}
