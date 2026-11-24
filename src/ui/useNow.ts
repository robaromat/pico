import { useEffect, useState } from 'preact/hooks';

/** L'heure actuelle, rafraîchie régulièrement (changement de moment de la journée, minuit…). */
export function useNow(everyMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    const vis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [everyMs]);
  return now;
}
