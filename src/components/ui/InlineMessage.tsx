import { AlertCircle, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineMessageProps {
  message: string;
  title?: string;
  tone?: 'error' | 'warning' | 'info';
  className?: string;
}

export default function InlineMessage({
  message,
  title = 'Let’s try that again.',
  tone = 'error',
  className,
}: InlineMessageProps) {
  const styles = {
    error: 'border-[#f0c4ba] bg-[#fff5f1] text-[#824636]',
    warning: 'border-[#efd88d] bg-[#fff9e8] text-[#725a16]',
    info: 'border-[#dcd8ff] bg-[#f7f6ff] text-[#45407b]',
  };
  const Icon = tone === 'warning' ? TriangleAlert : tone === 'info' ? Info : AlertCircle;

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5', styles[tone], className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block text-sm font-bold text-[#101a38]">{title}</strong>
        <p className="mt-0.5 text-sm leading-5">{message}</p>
      </div>
    </div>
  );
}
