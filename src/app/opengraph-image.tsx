import { ImageResponse } from 'next/og';

export const alt = 'Classfully, classroom participation that builds over time';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background: '#fffaf1',
          color: '#101a38',
          display: 'flex',
          fontFamily: 'Arial, sans-serif',
          height: '100%',
          overflow: 'hidden',
          padding: '64px 72px',
          position: 'relative',
          width: '100%',
        }}
      >
        <div style={{ background: '#dbf6e9', borderRadius: 999, height: 420, opacity: 0.78, position: 'absolute', right: -80, top: -120, width: 420 }} />
        <div style={{ background: '#e9e5ff', borderRadius: 999, bottom: -210, height: 500, opacity: 0.9, position: 'absolute', right: 100, width: 500 }} />
        <div style={{ background: '#ffd9c7', borderRadius: 999, bottom: -90, height: 250, left: -80, opacity: 0.8, position: 'absolute', width: 250 }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', width: '100%' }}>
          <div style={{ alignItems: 'center', display: 'flex', fontSize: 30, fontWeight: 700, gap: 15 }}>
            <span style={{ alignItems: 'center', background: '#5146e5', borderRadius: 18, color: 'white', display: 'flex', fontFamily: 'Georgia, serif', fontSize: 34, height: 58, justifyContent: 'center', width: 58 }}>C</span>
            Classfully
            <span style={{ background: '#20b767', borderRadius: 999, height: 12, marginLeft: 1, width: 12 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 890 }}>
            <div style={{ color: '#5146e5', fontSize: 20, fontWeight: 700, letterSpacing: 3, marginBottom: 22, textTransform: 'uppercase' }}>Built for university classrooms</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 72, letterSpacing: -3, lineHeight: 1.04 }}>Make every class count toward the next.</div>
            <div style={{ color: '#596177', fontSize: 25, lineHeight: 1.45, marginTop: 24 }}>Live participation today. A clearer course story tomorrow.</div>
          </div>

          <div style={{ alignItems: 'center', display: 'flex', fontSize: 20, gap: 14 }}>
            <span style={{ background: '#5146e5', borderRadius: 999, height: 10, width: 10 }} />
            Polls
            <span style={{ color: '#b6b9c7' }}>•</span>
            Quizzes
            <span style={{ color: '#b6b9c7' }}>•</span>
            Check-ins
            <span style={{ color: '#b6b9c7' }}>•</span>
            Progress over time
          </div>
        </div>
      </div>
    ),
    size,
  );
}
