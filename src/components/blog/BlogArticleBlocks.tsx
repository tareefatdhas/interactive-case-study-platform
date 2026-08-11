import Link from 'next/link';
import { ArrowRight, Check, Quotes } from '@phosphor-icons/react/ssr';
import type { BlogBlock } from '@/content/blog/types';

export default function BlogArticleBlocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return <p key={index} className="blog-article-paragraph">{block.text}</p>;
        }

        if (block.type === 'list') {
          return (
            <ul key={index} className="blog-article-list">
              {block.items.map((item) => <li key={item}><Check aria-hidden="true" /> <span>{item}</span></li>)}
            </ul>
          );
        }

        if (block.type === 'steps') {
          return (
            <ol key={index} className="blog-article-steps">
              {block.items.map((item, itemIndex) => (
                <li key={item.title}>
                  <span>{itemIndex + 1}</span>
                  <div><strong>{item.title}</strong><p>{item.body}</p></div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'callout') {
          return (
            <aside key={index} className={`blog-callout blog-tone-${block.tone}`}>
              {block.eyebrow ? <span>{block.eyebrow}</span> : null}
              <h3>{block.title}</h3>
              <p>{block.body}</p>
            </aside>
          );
        }

        if (block.type === 'quote') {
          return (
            <figure key={index} className="blog-quote">
              <Quotes aria-hidden="true" />
              <blockquote>{block.quote}</blockquote>
              {block.attribution ? <figcaption>{block.attribution}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === 'table') {
          return (
            <figure key={index} className="blog-table-wrap">
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
              <div className="blog-table-scroll">
                <table>
                  <thead><tr>{block.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </figure>
          );
        }

        return (
          <aside key={index} className={`blog-inline-cta blog-tone-${block.tone}`}>
            <div>
              {block.eyebrow ? <span>{block.eyebrow}</span> : null}
              <h3>{block.title}</h3>
              <p>{block.body}</p>
            </div>
            <Link href={block.href} className="marketing-button marketing-button-primary seminar-focus">
              {block.label} <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        );
      })}
    </>
  );
}
