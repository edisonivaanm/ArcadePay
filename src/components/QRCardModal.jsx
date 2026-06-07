import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';

/**
 * QRCardModal — shown to general users
 * Displays their personal QR code that admins can scan to recharge credits quickly.
 * The QR encodes: arcadepay:user:<uid>
 */
export default function QRCardModal({ onClose }) {
  const { currentUser, userProfile } = useAuth();
  const qrValue = `arcadepay:user:${currentUser.uid}`;

  const handleDownload = () => {
    const svg = document.getElementById('user-qr-svg');
    if (!svg) return;

    // Serialize SVG → Blob → Object URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Draw SVG into a high-res canvas (3× scale for sharp print quality)
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      // White background (required for PNG transparency → readable QR)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `arcadepay-qr-${userProfile?.usuario || 'user'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360, textAlign: 'center' }}>
        <div className="modal__handle" />

        <h2 className="modal__title">Mi código QR</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          Muéstraselo al administrador para recargar créditos rápidamente.
        </p>

        {/* QR Container */}
        <div style={{
          display: 'inline-flex',
          padding: '1.25rem',
          background: '#fff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          marginBottom: '1.25rem',
        }}>
          <QRCodeSVG
            id="user-qr-svg"
            value={qrValue}
            size={200}
            bgColor="#ffffff"
            fgColor="#0a0a0f"
            level="M"
          />
        </div>

        {/* User info */}
        <div style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem 1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.2rem' }}>
            {userProfile?.nombre} {userProfile?.apellido}
          </p>
          <p style={{ color: 'var(--color-accent)', fontSize: '0.88rem' }}>
            @{userProfile?.usuario}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
            {userProfile?.creditos ?? 0} créditos disponibles
          </p>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn--primary" onClick={handleDownload}>
            ⬇ Descargar PNG
          </button>
        </div>
      </div>
    </div>
  );
}
