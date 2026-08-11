import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { formatBlogDate } from '@/content/blog';
import type { BlogPost } from '@/content/blog/types';

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <article className="blog-card">
      <Link href={`/blog/${post.slug}`} className="blog-card-image seminar-focus" aria-label={`Read ${post.title}`}>
        <Image src={post.featuredImage} alt="" fill sizes="(max-width: 800px) 100vw, 45vw" />
      </Link>
      <div className="blog-card-copy">
        <div className="blog-card-meta"><span>{post.category}</span><span>{post.readingMinutes} min read</span></div>
        <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.description}</p>
        <div className="blog-card-footer"><time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time><ArrowRight aria-hidden="true" /></div>
      </div>
    </article>
  );
}
