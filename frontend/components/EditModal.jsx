'use client';

import { X } from 'lucide-react';

/**
 * Modal genérico usado por todas as telas de edição do painel.
 * Reaproveita os mesmos estilos (card, input-field, btn-primary) já usados
 * nos formulários de cadastro, para que "Cadastrar" e "Editar" fiquem visualmente
 * consistentes em todo o sistema (ver seção 9 e 16 do escopo de edição).
 */
export default function EditModal({ open, title, onClose, onSubmit, saving, children, wide }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`card p-5 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="text-ink-400 hover:text-ink-700 rounded p-1"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {children}

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-300/30 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
