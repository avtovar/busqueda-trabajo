import { useState } from 'react';

export default function LetterModal({ letter, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!letter) return null;

  function copy() {
    navigator.clipboard.writeText(letter.subject + '\n\n' + letter.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(letter.subject + '\n\n' + letter.body)}`;

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content letter">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        <h3>{letter.subject}</h3>
        <div className="letter-body">{letter.body}</div>
        <div className="letter-actions">
          <button className="btn" onClick={copy}>{copied ? '✓ Copiada' : 'Copiar carta'}</button>
          <a className="btn secondary" download="carta_presentacion.txt" href={href}>Descargar .txt</a>
        </div>
      </div>
    </div>
  );
}
