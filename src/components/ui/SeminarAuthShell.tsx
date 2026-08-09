import ClassfullyBrand from '@/components/marketing/ClassfullyBrand';
import { BarChart3, MessageCircleQuestion, MonitorUp, Radio, Smartphone, Users } from 'lucide-react';

interface SeminarAuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function SeminarAuthShell({ eyebrow, title, description, children }: SeminarAuthShellProps) {
  return (
    <main className="grid min-h-screen bg-[#fffefa] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.72fr)]">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <ClassfullyBrand className="w-fit text-2xl" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <p className="seminar-eyebrow mb-4">{eyebrow}</p>
          <h1 className="seminar-display text-4xl leading-tight text-[#101a38] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[#697087]">{description}</p>
          <div className="mt-9">{children}</div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-[#e3e5ed] bg-[#f3f2f8] lg:flex lg:items-center" aria-label="Classfully product preview">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_22%,rgba(112,87,232,0.14),transparent_34%),radial-gradient(circle_at_22%_78%,rgba(47,115,223,0.10),transparent_38%)]" />
        <div className="relative mx-auto h-[720px] w-full max-w-[560px] [perspective:1400px]" aria-hidden="true">
          <div className="absolute left-3 top-16 w-44 -rotate-[8deg] rounded-[24px] border border-white/90 bg-white/80 p-4 opacity-80 shadow-[0_18px_45px_rgba(16,26,56,0.12)] backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-[#e3e5ed] pb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#697087]"><Smartphone className="h-3.5 w-3.5 text-[#5146e5]" /> Student view</div>
            <div className="mt-4 h-2 w-20 rounded-full bg-[#dcd8ff]" />
            <div className="mt-3 grid grid-cols-2 gap-2"><i className="h-14 rounded-xl bg-[#f0efff]" /><i className="h-14 rounded-xl bg-[#fff0eb]" /></div>
            <div className="mt-3 h-8 rounded-lg bg-[#5146e5]" />
          </div>

          <div className="absolute bottom-20 right-0 w-56 rotate-[7deg] rounded-[22px] border border-white/90 bg-[#101a38] p-4 text-white opacity-80 shadow-[0_22px_55px_rgba(16,26,56,0.22)]">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/65"><MonitorUp className="h-3.5 w-3.5" /> Projector view</div>
            <p className="seminar-display mt-4 text-lg">How is the room feeling?</p>
            <div className="mt-5 flex h-20 items-end gap-2">{[42, 68, 88, 54, 76].map((height, index) => <i key={height} className="flex-1 rounded-t-full bg-[#8c7df2]" style={{ height: `${height}%`, opacity: 0.65 + index * 0.07 }} />)}</div>
          </div>

          <div className="absolute inset-x-10 top-28 origin-center rotate-[1.5deg] rounded-[28px] border border-white bg-white shadow-[0_34px_90px_rgba(16,26,56,0.20)] [transform:rotateY(-8deg)_rotateX(2deg)_rotateZ(1.5deg)] [transform-style:preserve-3d]">
            <div className="flex h-12 items-center justify-between rounded-t-[28px] border-b border-[#e3e5ed] bg-[#fbfbfd] px-5">
              <div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#df664e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#e6b84b]" /><i className="h-2.5 w-2.5 rounded-full bg-[#62ae78]" /></div>
              <span className="rounded-full bg-[#eeecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#5146e5]">Instructor console preview</span>
            </div>
            <div className="p-7">
              <div className="flex items-center justify-between border-b border-[#e3e5ed] pb-5">
                <div><p className="seminar-eyebrow">Classroom signal</p><p className="mt-1 text-xs text-[#697087]">Visible only while you teach</p></div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#eef8f0] px-3 py-1.5 text-[10px] font-bold text-[#2f7f47]"><i className="h-2 w-2 rounded-full bg-[#3aa45a]" /> Live</span>
              </div>
              <h2 className="seminar-display mt-6 text-[28px] leading-tight text-[#101a38]">The class is ready to continue.</h2>
              <div className="mt-6 space-y-3">
                {[
                  { icon: Users, label: '142 students connected', color: '#2f73df' },
                  { icon: MessageCircleQuestion, label: '7 questions waiting', color: '#7057e8' },
                  { icon: Radio, label: '12 students need a pause', color: '#ef7359' },
                ].map(({ icon: Icon, label, color }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-[#e3e5ed] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}><Icon className="h-4 w-4" /></span><span className="text-xs font-semibold text-[#313950]">{label}</span></div>)}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7f6ff] px-4 py-3 text-[11px] font-semibold text-[#555d73]"><BarChart3 className="h-4 w-4 text-[#5146e5]" /> Private details stay off the projector.</div>
            </div>
          </div>

          <p className="absolute bottom-5 left-1/2 w-full -translate-x-1/2 text-center text-xs font-semibold tracking-[0.02em] text-[#697087]">Instructor controls, student phones, and the shared screen stay in sync.</p>
        </div>
      </aside>
    </main>
  );
}
