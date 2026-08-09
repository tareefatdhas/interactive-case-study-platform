import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';

export default function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="marketing-page min-h-screen overflow-hidden bg-[var(--seminar-paper)] text-[var(--seminar-text)]">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </main>
  );
}
