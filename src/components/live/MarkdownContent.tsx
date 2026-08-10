import { Fragment, type ReactNode } from 'react';
import styles from './MarkdownContent.module.css';

type MarkdownContentProps = {
  markdown: string;
  className?: string;
  compact?: boolean;
  heading?: boolean;
};

const inlinePattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

function renderInline(value: string): ReactNode[] {
  return value.split(inlinePattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const items: string[] = [];
      const orderedList = Boolean(ordered);
      while (index < lines.length) {
        const match = orderedList
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const List = orderedList ? 'ol' : 'ul';
      blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>)}</List>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((text, lineIndex) => <Fragment key={`${text}-${lineIndex}`}>{lineIndex > 0 && <br />}{renderInline(text)}</Fragment>)}</p>);
  }

  return blocks;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/\*\*|__|[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderHeading(markdown: string): ReactNode[] {
  return markdown.replace(/\r/g, '').split('\n').filter((line) => line.trim()).map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 && <br />}
      {renderInline(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim())}
    </Fragment>
  ));
}

export default function MarkdownContent({ markdown, className = '', compact = false, heading = false }: MarkdownContentProps) {
  if (heading) return <h1 className={`${styles.heading} ${className}`.trim()}>{renderHeading(markdown)}</h1>;
  return <div className={`${styles.content} ${compact ? styles.compact : ''} ${className}`.trim()}>{renderBlocks(markdown)}</div>;
}
