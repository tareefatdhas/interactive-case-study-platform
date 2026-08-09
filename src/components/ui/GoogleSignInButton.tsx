import Button from '@/components/ui/Button';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.509h3.232c1.891-1.741 2.981-4.305 2.981-7.35Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.041.955-3.386.955-2.605 0-4.809-1.759-5.6-4.123H3.059v2.591A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.9A6.01 6.01 0 0 1 6.086 12c0-.659.114-1.3.314-1.9V7.509H3.059A9.996 9.996 0 0 0 2 12c0 1.614.386 3.141 1.059 4.491L6.4 13.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.991 14.695 2 12 2a9.996 9.996 0 0 0-8.941 5.509L6.4 10.1c.791-2.364 2.995-4.123 5.6-4.123Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function GoogleSignInButton({
  disabled,
  loading,
  onClick,
}: GoogleSignInButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full gap-3 border-[#d7dbe6] bg-white text-base text-[#16213f] shadow-[0_2px_8px_rgba(16,26,56,0.04)] hover:border-[#bfc5d4] hover:bg-[#fafaff]"
      disabled={disabled}
      loading={loading}
      onClick={onClick}
    >
      {!loading && <GoogleMark />}
      {loading ? 'Connecting to Google...' : 'Continue with Google'}
    </Button>
  );
}
