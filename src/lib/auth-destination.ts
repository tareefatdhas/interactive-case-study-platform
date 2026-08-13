export function safeAuthDestination(search: string): string {
  const nextPath = new URLSearchParams(search).get('next');
  return nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '';
}

export function authHref(path: '/login' | '/signup', search: string): string {
  const destination = safeAuthDestination(search);
  return destination ? `${path}?next=${encodeURIComponent(destination)}` : path;
}

export function invitationTokenFromDestination(destination: string): string {
  const match = destination.match(/^\/invite\/([a-f0-9]{64})$/i);
  return match?.[1] || '';
}
