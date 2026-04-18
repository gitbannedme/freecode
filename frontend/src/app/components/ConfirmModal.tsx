import React from "react";

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="dir-overlay" onClick={onCancel}>
      <div className="dir-box" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
        <div className="dir-title">{title}</div>
        <p style={{ color: "var(--dim2)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
        <div className="dir-actions" style={{ justifyContent: "flex-end", gap: 12 }}>
          <button className="dir-btn" style={{ background: "#da3633" }} onClick={onConfirm}>Delete</button>
          <button className="dir-btn dir-btn-tertiary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
