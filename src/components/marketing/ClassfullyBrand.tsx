import Link from 'next/link';
import ClassfullyMark from '@/components/brand/ClassfullyMark';

interface ClassfullyBrandProps {
  className?: string;
}

export default function ClassfullyBrand({ className = '' }: ClassfullyBrandProps) {
  return (
    <Link href="/" className={`classfully-lockup seminar-focus ${className}`.trim()} aria-label="Classfully home">
      <ClassfullyMark className="classfully-mark" />
      <span className="classfully-wordmark">Classfully</span>
    </Link>
  );
}
