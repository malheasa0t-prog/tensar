/**
 * Opens a print-optimized invoice window for an order so the customer can
 * print it or "Save as PDF" via the browser dialog — no external PDF library.
 */

import { buildInvoiceModel } from './invoiceModel.js';
import { formatCurrency } from './formatCurrency.js';

/**
 * Escapes a value for safe HTML interpolation.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the standalone invoice HTML document string.
 *
 * @param {ReturnType<typeof buildInvoiceModel>} invoice
 * @returns {string}
 */
export function buildInvoiceHtml(invoice) {
  const dateText = invoice.date ? new Date(invoice.date).toLocaleString('ar-JO') : '';
  const rows = invoice.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>${escapeHtml(formatCurrency(line.price))}</td><td>${escapeHtml(formatCurrency(line.lineTotal))}</td></tr>`
    )
    .join('');

  const discountRow = invoice.discount > 0
    ? `<tr><td colspan="3">الخصم${invoice.couponCode ? ' (' + escapeHtml(invoice.couponCode) + ')' : ''}</td><td>− ${escapeHtml(formatCurrency(invoice.discount))}</td></tr>`
    : '';

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>إيصال ${escapeHtml(invoice.number)}</title>
<style>
  body{font-family:'Cairo',Arial,sans-serif;color:#1f2937;margin:0;padding:32px;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6c5ce7;padding-bottom:16px;margin-bottom:20px;}
  .brand{font-size:1.5rem;font-weight:800;color:#6c5ce7;}
  .muted{color:#6b7280;font-size:.9rem;}
  table{width:100%;border-collapse:collapse;margin-top:12px;}
  th,td{text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;}
  th{background:#f9fafb;}
  tfoot td{font-weight:700;}
  .total{font-size:1.15rem;color:#16a34a;}
  @media print{button{display:none;}}
</style></head><body>
  <div class="head">
    <div><div class="brand">${escapeHtml(invoice.company.name)}</div>
      <div class="muted">${escapeHtml(invoice.company.phone)} · ${escapeHtml(invoice.company.email)}</div></div>
    <div style="text-align:left;"><div><strong>إيصال ${escapeHtml(invoice.number)}</strong></div>
      <div class="muted">${escapeHtml(dateText)}</div></div>
  </div>
  <div class="muted">العميل: <strong>${escapeHtml(invoice.customer.name)}</strong> — ${escapeHtml(invoice.customer.phone)}</div>
  <table>
    <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3">المجموع الفرعي</td><td>${escapeHtml(formatCurrency(invoice.subtotal))}</td></tr>
      <tr><td colspan="3">رسوم التوصيل</td><td>${escapeHtml(formatCurrency(invoice.shipping))}</td></tr>
      ${discountRow}
      <tr class="total"><td colspan="3">الإجمالي النهائي</td><td>${escapeHtml(formatCurrency(invoice.total))}</td></tr>
    </tfoot>
  </table>
  <p style="margin-top:24px;text-align:center;" class="muted">شكراً لتعاملك مع ${escapeHtml(invoice.company.name)}</p>
  <div style="text-align:center;margin-top:16px;"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
</body></html>`;
}

/**
 * Opens the invoice in a new window and triggers the print dialog.
 *
 * @param {{ order: Record<string, unknown>, items?: Array<Record<string, unknown>>, settings?: Record<string, unknown> }} input
 * @returns {boolean} Whether the print window opened.
 */
export function printOrderInvoice(input) {
  const invoice = buildInvoiceModel(input);
  const html = buildInvoiceHtml(invoice);
  const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch (printError) { void printError; }
  }, 300);
  return true;
}
