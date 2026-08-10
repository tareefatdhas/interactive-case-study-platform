import Image from 'next/image';
import { cn } from '@/lib/utils';

interface InstructorAvatarProps {
  name?: string;
  photoURL?: string;
  size?: number;
  className?: string;
}

export function getInstructorInitials(name?: string): string {
  const parts = (name || 'Instructor').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'I';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function InstructorAvatar({ name, photoURL, size = 40, className }: InstructorAvatarProps) {
  const label = name ? `${name}'s profile photo` : 'Instructor profile photo';

  return (
    <span
      className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#eceaff] font-bold tracking-[-0.02em] text-[#4137c7]', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }}
      role={photoURL ? undefined : 'img'}
      aria-label={photoURL ? undefined : `${label} not set. Showing initials.`}
    >
      {photoURL ? (
        <Image src={photoURL} alt={label} fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        <span aria-hidden="true">{getInstructorInitials(name)}</span>
      )}
    </span>
  );
}
