import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'preact/hooks';

/** Lit un QR code avec la caméra arrière. Appelle onCode avec le texte dès qu'un code est lu. */
export function Scanner({ onCode, onCancel }: { onCode: (text: string) => boolean; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('Vise le QR code affiché sur le téléphone parent.');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      const v = video.current;
      if (!alive || !v || !ctx) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const w = Math.min(640, v.videoWidth);
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (res?.data) {
          if (onCode(res.data)) return;
          setHint("Ce QR code n'est pas celui de Pico.");
        }
      }
      raf = requestAnimationFrame(scan);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        void v.play();
        raf = requestAnimationFrame(scan);
      })
      .catch(() => setErr("Impossible d'ouvrir la caméra. Autorise-la pour Pico dans les réglages de l'appareil."));
    if (!navigator.mediaDevices) setErr("Cet appareil ne donne pas accès à la caméra.");

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="scanner">
      <video ref={video} playsInline muted />
      <div class="scan-frame" aria-hidden="true" />
      <div class="scan-bar">
        <p>{err || hint}</p>
        <button class="pbtn" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
