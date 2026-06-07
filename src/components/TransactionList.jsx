/**
 * TransactionList — shared component for displaying transactions
 * Props:
 *   transactions: array of transaction objects
 *   showUser: boolean — show user name (for admin global view)
 *   emptyText: string
 */
export default function TransactionList({ transactions = [], showUser = false, emptyText = 'No hay transacciones aún.' }) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📋</div>
        <p className="empty-state__text">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="tx-list">
      {transactions.map((tx) => {
        const isRecarga = tx.tipo === 'recarga';
        const fecha = tx.fecha?.toDate?.() || new Date();
        const fechaStr = fecha.toLocaleDateString('es-EC', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        return (
          <div key={tx.id} className="tx-item">
            <div className={`tx-icon tx-icon--${tx.tipo}`}>
              {isRecarga ? '💰' : '🎮'}
            </div>
            <div className="tx-info">
              <div className="tx-title">{tx.titulo}</div>
              <div className="tx-meta">
                {showUser && tx._userName && (
                  <span style={{ color: 'var(--color-accent)', marginRight: '0.5rem' }}>
                    @{tx._userName}
                  </span>
                )}
                {fechaStr}
              </div>
            </div>
            <div className={`tx-amount tx-amount--${isRecarga ? 'positive' : 'negative'}`}>
              {isRecarga ? '+' : ''}{tx.monto}
            </div>
          </div>
        );
      })}
    </div>
  );
}
