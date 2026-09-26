'use client';

import { Pencil } from 'lucide-react';

/**
 * Botão de edição padrão usado em todas as tabelas/listas do painel.
 * Mantém aparência e comportamento consistentes (ícone + tooltip) em
 * desktop e mobile (ver seção 2 e 13 do escopo de edição).
 */
export default function EditButton({ onClick, label = 'Editar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 text-xs font-medium text-olive-700 hover:text-olive-900 hover:underline px-1.5 py-1 rounded"
    >
      <Pencil size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
