// ============================================================================
// Exportação de relatórios (seção 28 do escopo).
//
// CSV é gerado manualmente (sem dependências) para abrir direto no Excel.
// PDF usa jsPDF + jspdf-autotable, carregados dinamicamente no navegador
// (import() dentro da função) para não pesar o bundle inicial do app.
// ============================================================================

export function exportToCSV(filename, headers, rows) {
  const escapeCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Ponto e vírgula como separador: Excel em português (pt-BR) usa vírgula
  // como separador decimal, então trata ";" como delimitador de coluna por
  // padrão ao abrir CSVs.
  const lines = [headers.map(escapeCell).join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(';'));
  }

  // BOM UTF-8 para acentuação correta ao abrir no Excel.
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportToPDF(title, headers, rows) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Granja Oliveira', 14, 16);
  doc.setFontSize(11);
  doc.text(title, 14, 24);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 30);

  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 36,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 86, 41] }, // olive-700
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
