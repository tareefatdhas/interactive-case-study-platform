import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock } from '@phosphor-icons/react/ssr';
import BlogArticleBlocks from '@/components/blog/BlogArticleBlocks';
import MarketingPage from '@/components/marketing/MarketingPage';
import { blogPosts, formatBlogDate, getAuthorInitials, getBlogPost } from '@/content/blog';
import { SITE_NAME, SITE_URL } from '@/lib/metadata';

type BlogArticlePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  const url = `/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    keywords: [post.primaryKeyword, ...post.secondaryKeywords],
    authors: [{ name: post.author.name }],
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url,
      siteName: SITE_NAME,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author.name],
      tags: post.tags,
      images: [{ url: post.featuredImage, width: 1536, height: 1024, alt: post.featuredImageAlt }],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description, images: [post.featuredImage] },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: [`${SITE_URL}${post.featuredImage}`],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    mainEntityOfPage: articleUrl,
    author: { '@type': 'Person', name: post.author.name },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };

  return (
    <MarketingPage>
      <div className="blog-article">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
        <header className="blog-article-hero">
          <div className="mx-auto max-w-7xl px-5 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-14">
            <Link href="/blog" className="blog-back-link seminar-focus"><ArrowLeft aria-hidden="true" /> Field Notes</Link>
            <div className="blog-article-hero-grid">
              <div className="blog-article-heading">
                <p className="seminar-eyebrow">{post.category}</p>
                <h1 className="seminar-display">{post.title}</h1>
                <p className="blog-article-dek">{post.dek}</p>
                <div className="blog-article-byline">
                  <span className="blog-author-monogram" aria-hidden="true">{getAuthorInitials(post.author.name)}</span>
                  <div><strong>{post.author.name}</strong><span>{post.author.role}</span></div>
                </div>
                <div className="blog-article-meta">
                  <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  <span><Clock aria-hidden="true" /> {post.readingMinutes} min read</span>
                </div>
              </div>
              <figure className="blog-article-cover">
                <Image src={post.featuredImage} alt={post.featuredImageAlt} fill priority sizes="(max-width: 960px) 100vw, 52vw" />
              </figure>
            </div>
          </div>
        </header>

        <section className="blog-signal-thread" aria-label="The classroom signal">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            {[
              ['The problem', post.signal.problem],
              ['The live moment', post.signal.classroomMoment],
              ['What carries forward', post.signal.nextSession],
            ].map(([label, value], index) => (
              <div key={label}><span>{index + 1}</span><div><strong>{label}</strong><p>{value}</p></div></div>
            ))}
          </div>
        </section>

        <div className="blog-reading-layout mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <aside className="blog-article-toc" aria-label="On this page">
            <strong>On this page</strong>
            <nav>{post.sections.map((section) => <a key={section.id} href={`#${section.id}`} className="seminar-focus">{section.title}</a>)}</nav>
          </aside>

          <article className="blog-article-body">
            <aside className="blog-takeaway">
              <span>In one minute</span>
              <p>{post.takeaway}</p>
            </aside>
            {post.sections.map((section) => (
              <section key={section.id} id={section.id} className="blog-content-section">
                {section.eyebrow ? <p className="seminar-eyebrow">{section.eyebrow}</p> : null}
                <h2 className="seminar-display">{section.title}</h2>
                <BlogArticleBlocks blocks={section.blocks} />
              </section>
            ))}
          </article>

          <aside className="blog-article-side">
            <div className="blog-side-card">
              <span className="seminar-eyebrow">Try it next class</span>
              <h2 className="seminar-display">One check-in. One understanding check. One reflection.</h2>
              <p>Start with three moments and build only when the lesson calls for more.</p>
              <Link href="/signup" className="marketing-button marketing-button-primary seminar-focus">Create a class <ArrowRight aria-hidden="true" /></Link>
            </div>
            <Link href="/resources" className="blog-copy-link seminar-focus">Open the classroom checklist <ArrowRight aria-hidden="true" /></Link>
          </aside>
        </div>
      </div>
    </MarketingPage>
  );
}
