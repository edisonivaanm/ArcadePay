import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const QR_PREFIX = 'arcadepay:user:';

/**
 * QRScannerModal — shown to admins
 * Opens the device camera, scans a user's QR code, and returns their UID.
 * onScan(uid) is called when a valid ArcadePay QR is detected.
 */
export default function QRScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Autoriza el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en este dispositivo.');
      } else {
        setError('No se pudo acceder a la cámara. Intenta de nuevo.');
      }
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  };

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code?.data?.startsWith(QR_PREFIX)) {
      const uid = code.data.slice(QR_PREFIX.length);
      stopCamera();
      setScanning(false);
      onScan(uid);
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420, padding: '1.5rem' }}>
        <div className="modal__handle" />
        <h2 className="modal__title">Escanear QR de usuario</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Apunta la cámara al código QR del usuario para cargarlo automáticamente.
        </p>

        {error ? (
          <div>
            <div className="alert alert--error">{error}</div>
            <div className="modal__actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn--primary" onClick={startCamera}>Reintentar</button>
            </div>
          </div>
        ) : (
          <>
            {/* Camera viewfinder */}
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: '#000',
              aspectRatio: '1 / 1',
              marginBottom: '1rem',
            }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                muted
                playsInline
              />

              {/* QR Targeting frame */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'relative', width: '60%', aspectRatio: '1 / 1' }}>
                  {/* Corner brackets */}
                  {[
                    { top: 0, left: 0, borderTop: '3px solid #06b6d4', borderLeft: '3px solid #06b6d4', borderRadius: '4px 0 0 0' },
                    { top: 0, right: 0, borderTop: '3px solid #06b6d4', borderRight: '3px solid #06b6d4', borderRadius: '0 4px 0 0' },
                    { bottom: 0, left: 0, borderBottom: '3px solid #06b6d4', borderLeft: '3px solid #06b6d4', borderRadius: '0 0 0 4px' },
                    { bottom: 0, right: 0, borderBottom: '3px solid #06b6d4', borderRight: '3px solid #06b6d4', borderRadius: '0 0 4px 0' },
                  ].map((style, i) => (
                    <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...style }} />
                  ))}

                  {/* Scan line animation */}
                  {scanning && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0, height: 2,
                      background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                      animation: 'scanLine 1.8s linear infinite',
                    }} />
                  )}
                </div>
              </div>

              {/* Dim overlay outside target */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle 30% at center, transparent 100%, rgba(0,0,0,0.5) 100%)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Hidden canvas for QR processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <p style={{
              textAlign: 'center', color: 'var(--color-text-muted)',
              fontSize: '0.8rem', marginBottom: '1rem',
            }}>
              {scanning ? '📷 Buscando código QR...' : '✅ ¡Detectado!'}
            </p>

            <button className="btn btn--ghost btn--full" onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 5%; }
          50%  { top: 95%; }
          100% { top: 5%; }
        }
      `}</style>
    </div>
  );
}
