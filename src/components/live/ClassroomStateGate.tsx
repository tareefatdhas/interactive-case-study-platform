import { LoaderCircle } from 'lucide-react';
import styles from './ClassroomStateGate.module.css';

type ClassroomStateGateProps = {
  title?: string;
  message?: string;
  loading?: boolean;
};

export default function ClassroomStateGate({
  title = 'Connecting to your class',
  message = 'Loading the latest session information.',
  loading = true,
}: ClassroomStateGateProps) {
  return (
    <main className={styles.gate} aria-busy={loading} aria-live="polite">
      <div className={styles.content} role="status">
        <div className={styles.brand}>Classfully<span>.</span></div>
        {loading && <LoaderCircle className={styles.spinner} aria-hidden="true" />}
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </main>
  );
}
