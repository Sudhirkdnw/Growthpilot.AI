import { InvoiceDocumentDTO } from '../../../../shared/types';
import { formatQuantity } from '../../../../shared/utils/quantity';

/**
 * Escapes HTML characters safely
 */
function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats date and time cleanly
 */
function formatDateTime(isoString: string): { dateStr: string; timeStr: string } {
  try {
    const d = new Date(isoString);
    return {
      dateStr: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      timeStr: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { dateStr: isoString, timeStr: '' };
  }
}

/**
 * A4 Standard Full-Page Invoice Template
 * Engineered for multi-page compatibility, repeating table headers, and clean enterprise layout.
 */
export function renderA4InvoiceHtml(doc: InvoiceDocumentDTO): string {
  const { dateStr, timeStr } = formatDateTime(doc.date);
  const isCancelled = doc.status === 'CANCELLED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(doc.title)} - ${escapeHtml(doc.documentNumber)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .invoice-container {
      width: 100%;
      position: relative;
    }
    ${
      isCancelled
        ? `
    .watermark {
      position: fixed;
      top: 35%;
      left: 20%;
      font-size: 80px;
      font-weight: 900;
      color: rgba(239, 68, 68, 0.15);
      transform: rotate(-30deg);
      z-index: 9999;
      pointer-events: none;
      letter-spacing: 4px;
    }
    `
        : ''
    }
    /* Header Styles */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .company-meta {
      font-size: 10px;
      color: #475569;
      line-height: 1.35;
    }
    .doc-badge {
      text-align: right;
      vertical-align: top;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #f97316;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .doc-meta-table {
      margin-left: auto;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .doc-meta-table td {
      padding: 2px 4px;
    }
    .doc-meta-table .label {
      font-weight: 600;
      color: #64748b;
      text-align: right;
    }
    .doc-meta-table .val {
      font-weight: 700;
      color: #0f172a;
      text-align: right;
    }

    /* Billing Boxes */
    .parties-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .party-box {
      width: 49%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      vertical-align: top;
    }
    .party-title {
      font-size: 10px;
      font-weight: 700;
      color: #ea580c;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 2px;
    }
    .party-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .party-detail {
      font-size: 10px;
      color: #475569;
      line-height: 1.35;
    }

    /* Items Table */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    table.items-table thead {
      display: table-header-group; /* repeats on multi-page */
    }
    table.items-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 6px;
      border: 1px solid #0f172a;
    }
    table.items-table tr {
      page-break-inside: avoid;
    }
    table.items-table td {
      padding: 6px 6px;
      border: 1px solid #e2e8f0;
      font-size: 10px;
      vertical-align: top;
    }
    table.items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }

    /* Summary & Totals Area */
    .summary-container {
      width: 100%;
      page-break-inside: avoid;
      margin-top: 10px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    .words-box {
      width: 55%;
      vertical-align: top;
      padding-right: 16px;
    }
    .words-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .words-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .words-text {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
      font-style: italic;
    }
    .totals-box {
      width: 45%;
      vertical-align: top;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .totals-table td {
      padding: 5px 8px;
      font-size: 10.5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-table .total-label {
      color: #475569;
      font-weight: 500;
    }
    .totals-table .total-val {
      text-align: right;
      font-weight: 600;
      color: #0f172a;
    }
    .grand-total-row td {
      background: #0f172a !important;
      color: #ffffff !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      padding: 8px 8px !important;
      border-top: 2px solid #ea580c !important;
    }
    .grand-total-row .total-label {
      color: #fdba74 !important;
    }
    .grand-total-row .total-val {
      color: #ffffff !important;
    }
    .due-row td {
      background: #fef2f2 !important;
      color: #b91c1c !important;
      font-weight: 700 !important;
    }

    /* Footer & Signatures */
    .footer-section {
      margin-top: 28px;
      page-break-inside: avoid;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
    }
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 30px;
    }
    .signatures-table td {
      width: 50%;
      vertical-align: bottom;
      padding: 0 10px;
    }
    .sign-line {
      border-top: 1px solid #64748b;
      margin-top: 40px;
      padding-top: 4px;
      text-align: center;
      font-size: 9.5px;
      font-weight: 600;
      color: #475569;
    }
    .terms-text {
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.35;
      margin-top: 10px;
    }
    .print-meta {
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    ${isCancelled ? '<div class="watermark">CANCELLED</div>' : ''}

    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="company-title">${escapeHtml(doc.company.shopName)}</div>
          <div class="company-meta">
            ${doc.company.address ? `<div>${escapeHtml(doc.company.address)}</div>` : ''}
            ${doc.company.phone ? `<div>Phone: ${escapeHtml(doc.company.phone)}</div>` : ''}
            ${doc.company.email ? `<div>Email: ${escapeHtml(doc.company.email)}</div>` : ''}
            ${doc.company.gstin ? `<div><strong>GSTIN:</strong> ${escapeHtml(doc.company.gstin)}</div>` : ''}
          </div>
        </td>
        <td class="doc-badge">
          <div class="doc-title">${escapeHtml(doc.title)}</div>
          <table class="doc-meta-table">
            <tr>
              <td class="label">Doc No:</td>
              <td class="val">${escapeHtml(doc.documentNumber)}</td>
            </tr>
            ${
              doc.originalDocumentNumber
                ? `
            <tr>
              <td class="label">Ref Invoice:</td>
              <td class="val">${escapeHtml(doc.originalDocumentNumber)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td class="label">Date:</td>
              <td class="val">${dateStr}</td>
            </tr>
            <tr>
              <td class="label">Time:</td>
              <td class="val">${timeStr}</td>
            </tr>
            <tr>
              <td class="label">Status:</td>
              <td class="val" style="color: ${isCancelled ? '#ef4444' : '#10b981'};">${escapeHtml(doc.status)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Billing Info -->
    <table class="parties-table">
      <tr>
        <td class="party-box">
          <div class="party-title">${doc.documentType.startsWith('PURCHASE') ? 'Vendor / Supplier' : 'Customer / Bill To'}</div>
          <div class="party-name">${escapeHtml(doc.party.name)}</div>
          <div class="party-detail">
            ${doc.party.phone ? `<div><strong>Phone:</strong> ${escapeHtml(doc.party.phone)}</div>` : ''}
            ${doc.party.address ? `<div><strong>Address:</strong> ${escapeHtml(doc.party.address)}</div>` : ''}
            ${doc.party.gstin ? `<div><strong>GSTIN:</strong> ${escapeHtml(doc.party.gstin)}</div>` : ''}
          </div>
        </td>
        <td style="width: 2%;"></td>
        <td class="party-box">
          <div class="party-title">Payment & Settlement</div>
          <div class="party-detail" style="font-size: 10.5px;">
            <div><strong>Payment Mode:</strong> ${escapeHtml(doc.paymentMethod)}</div>
            <div><strong>Paid Amount:</strong> ${escapeHtml(doc.currencySymbol)}${doc.paidAmount.toFixed(2)}</div>
            ${
              doc.dueAmount > 0
                ? `<div style="color: #b91c1c; font-weight: 700;"><strong>Balance Due:</strong> ${escapeHtml(doc.currencySymbol)}${doc.dueAmount.toFixed(2)}</div>`
                : `<div style="color: #15803d; font-weight: 600;"><strong>Status:</strong> Fully Settled</div>`
            }
            ${doc.notes ? `<div style="margin-top: 4px;"><strong>Notes:</strong> ${escapeHtml(doc.notes)}</div>` : ''}
          </div>
        </td>
      </tr>
    </table>

    <!-- Line Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 4%; text-align: center;">#</th>
          <th style="width: 36%; text-align: left;">Item Description</th>
          <th style="width: 10%; text-align: center;">SKU</th>
          <th style="width: 8%; text-align: center;">Qty</th>
          <th style="width: 6%; text-align: center;">Unit</th>
          <th style="width: 10%; text-align: right;">Rate</th>
          <th style="width: 8%; text-align: right;">Disc</th>
          <th style="width: 8%; text-align: right;">Tax</th>
          <th style="width: 10%; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${doc.items
          .map(
            (it) => `
          <tr>
            <td class="text-center">${it.rowNumber}</td>
            <td>
              <div class="font-semibold">${escapeHtml(it.name)}</div>
            </td>
            <td class="text-center" style="font-size: 9px; color: #64748b;">${escapeHtml(it.sku)}</td>
            <td class="text-center font-bold">${formatQuantity(it.quantity, it.unitCode)}</td>
            <td class="text-center" style="font-size: 9px; color: #64748b;">${escapeHtml(it.unitCode)}</td>
            <td class="text-right">${doc.currencySymbol}${it.unitPrice.toFixed(2)} / ${escapeHtml(it.unitCode || 'unit')}</td>
            <td class="text-right">${it.discount > 0 ? `-${doc.currencySymbol}${it.discount.toFixed(2)}` : '-'}</td>
            <td class="text-right" style="font-size: 9px;">
              ${it.taxAmount > 0 ? `${doc.currencySymbol}${it.taxAmount.toFixed(2)}<br><span style="color:#64748b;">(${it.taxRate}%)</span>` : '-'}
            </td>
            <td class="text-right font-bold">${doc.currencySymbol}${it.lineTotal.toFixed(2)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <!-- Summary & Totals -->
    <div class="summary-container">
      <table class="summary-table">
        <tr>
          <td class="words-box">
            <div class="words-card">
              <div class="words-title">Amount in Words</div>
              <div class="words-text">${escapeHtml(doc.amountInWords)}</div>
            </div>
            ${
              doc.footerNotes
                ? `<div style="font-size: 9.5px; color: #475569; margin-top: 6px;">
                    <strong>Note:</strong> ${escapeHtml(doc.footerNotes)}
                  </div>`
                : ''
            }
          </td>
          <td class="totals-box">
            <table class="totals-table">
              <tr>
                <td class="total-label">Subtotal</td>
                <td class="total-val">${doc.currencySymbol}${doc.subtotal.toFixed(2)}</td>
              </tr>
              ${
                doc.totalDiscount > 0
                  ? `
              <tr>
                <td class="total-label">Total Discount</td>
                <td class="total-val" style="color: #ea580c;">-${doc.currencySymbol}${doc.totalDiscount.toFixed(2)}</td>
              </tr>`
                  : ''
              }
              ${
                doc.taxTotal > 0
                  ? `
              <tr>
                <td class="total-label">Tax (GST)</td>
                <td class="total-val">${doc.currencySymbol}${doc.taxTotal.toFixed(2)}</td>
              </tr>`
                  : ''
              }
              <tr class="grand-total-row">
                <td class="total-label">GRAND TOTAL</td>
                <td class="total-val">${doc.currencySymbol}${doc.grandTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td class="total-label">Paid (${escapeHtml(doc.paymentMethod)})</td>
                <td class="total-val">${doc.currencySymbol}${doc.paidAmount.toFixed(2)}</td>
              </tr>
              ${
                doc.dueAmount > 0
                  ? `
              <tr class="due-row">
                <td class="total-label">Balance Due</td>
                <td class="total-val">${doc.currencySymbol}${doc.dueAmount.toFixed(2)}</td>
              </tr>`
                  : ''
              }
              ${
                doc.changeAmount > 0
                  ? `
              <tr>
                <td class="total-label">Change Returned</td>
                <td class="total-val" style="color: #15803d;">${doc.currencySymbol}${doc.changeAmount.toFixed(2)}</td>
              </tr>`
                  : ''
              }
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Signatures & Terms -->
    <div class="footer-section">
      <table class="signatures-table">
        <tr>
          <td>
            <div class="sign-line">Customer Signature</div>
          </td>
          <td>
            <div class="sign-line">Authorized Signatory for ${escapeHtml(doc.company.shopName)}</div>
          </td>
        </tr>
      </table>

      ${
        doc.termsAndConditions
          ? `
      <div class="terms-text">
        <strong>Terms & Conditions:</strong> ${escapeHtml(doc.termsAndConditions)}
      </div>`
          : ''
      }

      <div class="print-meta">
        Generated electronically by RS Inventory – Solo on ${dateStr} ${timeStr}. Original authentic invoice.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 80mm Thermal Receipt Template (~72mm printable width)
 * High-contrast, narrow format with dotted dividers, item wrapping, and compact totals.
 */
export function renderThermal80mmHtml(doc: InvoiceDocumentDTO): string {
  const { dateStr, timeStr } = formatDateTime(doc.date);
  const isCancelled = doc.status === 'CANCELLED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(doc.documentNumber)} - 80mm Receipt</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000000;
      width: 76mm;
      margin: 0 auto;
      padding: 6px 4px;
      background: #ffffff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .border-b { border-bottom: 1px dashed #000000; padding-bottom: 5px; margin-bottom: 5px; }
    .border-t { border-top: 1px dashed #000000; padding-top: 5px; margin-top: 5px; }
    .border-double { border-top: 2px dashed #000000; border-bottom: 2px dashed #000000; padding: 4px 0; margin: 5px 0; }
    
    .shop-header h1 {
      font-size: 15px;
      margin: 0 0 3px 0;
      text-transform: uppercase;
      font-weight: 900;
    }
    .shop-header p {
      margin: 1.5px 0;
      font-size: 10px;
    }
    .doc-type-badge {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin-bottom: 2px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0;
      font-size: 10.5px;
    }
    table.items-table th {
      border-bottom: 1px solid #000000;
      padding: 3px 0;
      text-align: left;
      font-size: 10px;
    }
    table.items-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .item-name {
      word-break: break-word;
      font-weight: 600;
    }
    .item-subtext {
      font-size: 9px;
      color: #333333;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 2.5px;
    }
    .grand-total {
      font-size: 14px;
      font-weight: 900;
    }
    .words-box {
      font-size: 9px;
      font-style: italic;
      margin: 4px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      font-size: 9.5px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  ${
    isCancelled
      ? `<div style="text-align: center; color: red; font-size: 16px; font-weight: 900; border: 2px solid red; padding: 2px; margin-bottom: 6px;">*** CANCELLED ***</div>`
      : ''
  }
  <div class="shop-header text-center border-b">
    <h1>${escapeHtml(doc.company.shopName)}</h1>
    ${doc.company.address ? `<p>${escapeHtml(doc.company.address)}</p>` : ''}
    ${doc.company.phone ? `<p>Phone: ${escapeHtml(doc.company.phone)}</p>` : ''}
    ${doc.company.gstin ? `<p>GSTIN: ${escapeHtml(doc.company.gstin)}</p>` : ''}
    <div class="doc-type-badge">${escapeHtml(doc.title)}</div>
  </div>

  <div class="border-b">
    <div class="meta-row">
      <span><strong>Doc:</strong> ${escapeHtml(doc.documentNumber)}</span>
      <span>${dateStr} ${timeStr}</span>
    </div>
    ${
      doc.originalDocumentNumber
        ? `<div class="meta-row"><span><strong>Ref:</strong> ${escapeHtml(doc.originalDocumentNumber)}</span></div>`
        : ''
    }
    <div class="meta-row">
      <span><strong>Party:</strong> ${escapeHtml(doc.party.name)}</span>
      ${doc.party.phone ? `<span>Ph: ${escapeHtml(doc.party.phone)}</span>` : ''}
    </div>
    ${
      doc.party.gstin
        ? `<div class="meta-row"><span><strong>GSTIN:</strong> ${escapeHtml(doc.party.gstin)}</span></div>`
        : ''
    }
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 48%;">Item</th>
        <th style="width: 14%; text-align: center;">Qty</th>
        <th style="width: 18%; text-align: right;">Rate</th>
        <th style="width: 20%; text-align: right;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${doc.items
        .map(
          (it) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(it.name)}</div>
            <div class="item-subtext">${formatQuantity(it.quantity, it.unitCode)} × ${doc.currencySymbol}${it.unitPrice.toFixed(2)}/${escapeHtml(it.unitCode || 'unit')}</div>
            ${it.discount > 0 ? `<div class="item-subtext">Disc: -${doc.currencySymbol}${it.discount.toFixed(2)}</div>` : ''}
            ${it.taxAmount > 0 ? `<div class="item-subtext">Tax: ${doc.currencySymbol}${it.taxAmount.toFixed(2)} (${it.taxRate}%)</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: bold;">${formatQuantity(it.quantity, it.unitCode)}</td>
          <td style="text-align: right;">${it.unitPrice.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">${it.lineTotal.toFixed(2)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="border-t">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>${doc.currencySymbol}${doc.subtotal.toFixed(2)}</span>
    </div>
    ${
      doc.totalDiscount > 0
        ? `
    <div class="totals-row">
      <span>Discount:</span>
      <span>-${doc.currencySymbol}${doc.totalDiscount.toFixed(2)}</span>
    </div>`
        : ''
    }
    ${
      doc.taxTotal > 0
        ? `
    <div class="totals-row">
      <span>Tax:</span>
      <span>${doc.currencySymbol}${doc.taxTotal.toFixed(2)}</span>
    </div>`
        : ''
    }
    <div class="totals-row border-double grand-total">
      <span>TOTAL:</span>
      <span>${doc.currencySymbol}${doc.grandTotal.toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Paid (${escapeHtml(doc.paymentMethod)}):</span>
      <span>${doc.currencySymbol}${doc.paidAmount.toFixed(2)}</span>
    </div>
    ${
      doc.dueAmount > 0
        ? `
    <div class="totals-row font-bold" style="color: #b91c1c;">
      <span>Balance Due:</span>
      <span>${doc.currencySymbol}${doc.dueAmount.toFixed(2)}</span>
    </div>`
        : ''
    }
    ${
      doc.changeAmount > 0
        ? `
    <div class="totals-row">
      <span>Change Returned:</span>
      <span>${doc.currencySymbol}${doc.changeAmount.toFixed(2)}</span>
    </div>`
        : ''
    }
  </div>

  <div class="words-box">
    ${escapeHtml(doc.amountInWords)}
  </div>

  <div class="footer border-t">
    ${doc.footerNotes ? `<p>${escapeHtml(doc.footerNotes)}</p>` : ''}
    ${doc.termsAndConditions ? `<p style="font-size: 8px;">${escapeHtml(doc.termsAndConditions)}</p>` : ''}
    <p style="font-size: 8px; color: #555;">Thank you for shopping with us!</p>
  </div>
</body>
</html>`;
}

/**
 * 58mm Thermal Receipt Template (~48mm printable width)
 * Ultra-compact layout optimized for narrow retail POS receipt rolls.
 */
export function renderThermal58mmHtml(doc: InvoiceDocumentDTO): string {
  const { dateStr, timeStr } = formatDateTime(doc.date);
  const isCancelled = doc.status === 'CANCELLED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(doc.documentNumber)} - 58mm Receipt</title>
  <style>
    @page {
      size: 58mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      font-size: 9.5px;
      line-height: 1.25;
      color: #000000;
      width: 48mm;
      margin: 0 auto;
      padding: 4px 2px;
      background: #ffffff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .border-b { border-bottom: 1px dashed #000000; padding-bottom: 4px; margin-bottom: 4px; }
    .border-t { border-top: 1px dashed #000000; padding-top: 4px; margin-top: 4px; }
    .border-double { border-top: 1px dashed #000000; border-bottom: 1px dashed #000000; padding: 3px 0; margin: 4px 0; }
    
    .shop-header h1 {
      font-size: 13px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      font-weight: 900;
    }
    .shop-header p {
      margin: 1px 0;
      font-size: 8.5px;
    }
    .doc-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .meta-line {
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      margin-bottom: 1.5px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 9px;
    }
    table.items-table th {
      border-bottom: 1px solid #000000;
      padding: 2px 0;
      font-size: 8.5px;
    }
    table.items-table td {
      padding: 2.5px 0;
      vertical-align: top;
    }
    .item-name {
      word-break: break-word;
      font-weight: 600;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      margin-bottom: 2px;
    }
    .grand-total {
      font-size: 12px;
      font-weight: 900;
    }
    .footer {
      text-align: center;
      font-size: 8.5px;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  ${
    isCancelled
      ? `<div style="text-align: center; color: red; font-size: 12px; font-weight: 900; border: 1px solid red; padding: 1px; margin-bottom: 4px;">* CANCELLED *</div>`
      : ''
  }
  <div class="shop-header text-center border-b">
    <h1>${escapeHtml(doc.company.shopName)}</h1>
    ${doc.company.address ? `<p>${escapeHtml(doc.company.address)}</p>` : ''}
    ${doc.company.phone ? `<p>Ph: ${escapeHtml(doc.company.phone)}</p>` : ''}
    ${doc.company.gstin ? `<p>GST: ${escapeHtml(doc.company.gstin)}</p>` : ''}
    <div class="doc-badge">${escapeHtml(doc.title)}</div>
  </div>

  <div class="border-b">
    <div class="meta-line">
      <span><strong>Inv:</strong> ${escapeHtml(doc.documentNumber)}</span>
      <span>${dateStr}</span>
    </div>
    <div class="meta-line">
      <span><strong>Party:</strong> ${escapeHtml(doc.party.name)}</span>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 50%; text-align: left;">Item</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 35%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${doc.items
        .map(
          (it) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(it.name)}</div>
            <div style="font-size: 7.5px; color: #444;">${formatQuantity(it.quantity, it.unitCode)} × ${doc.currencySymbol}${it.unitPrice.toFixed(2)}/${escapeHtml(it.unitCode || 'unit')}${it.discount > 0 ? ` (D:-${it.discount.toFixed(2)})` : ''}</div>
          </td>
          <td style="text-align: center; font-weight: bold;">${formatQuantity(it.quantity, it.unitCode)}</td>
          <td style="text-align: right; font-weight: bold;">${doc.currencySymbol}${it.lineTotal.toFixed(2)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="border-t">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>${doc.currencySymbol}${doc.subtotal.toFixed(2)}</span>
    </div>
    ${
      doc.totalDiscount > 0
        ? `
    <div class="totals-row">
      <span>Disc:</span>
      <span>-${doc.currencySymbol}${doc.totalDiscount.toFixed(2)}</span>
    </div>`
        : ''
    }
    ${
      doc.taxTotal > 0
        ? `
    <div class="totals-row">
      <span>Tax:</span>
      <span>${doc.currencySymbol}${doc.taxTotal.toFixed(2)}</span>
    </div>`
        : ''
    }
    <div class="totals-row border-double grand-total">
      <span>TOTAL:</span>
      <span>${doc.currencySymbol}${doc.grandTotal.toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Paid (${escapeHtml(doc.paymentMethod)}):</span>
      <span>${doc.currencySymbol}${doc.paidAmount.toFixed(2)}</span>
    </div>
    ${
      doc.dueAmount > 0
        ? `
    <div class="totals-row font-bold" style="color: #b91c1c;">
      <span>Due:</span>
      <span>${doc.currencySymbol}${doc.dueAmount.toFixed(2)}</span>
    </div>`
        : ''
    }
  </div>

  <div class="footer border-t">
    ${doc.footerNotes ? `<p>${escapeHtml(doc.footerNotes)}</p>` : ''}
    <p>Thank You!</p>
  </div>
</body>
</html>`;
}

/**
 * Universal dispatcher
 */
export function renderInvoiceHtml(
  doc: InvoiceDocumentDTO,
  format: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM' = 'A4'
): string {
  switch (format) {
    case 'THERMAL_58MM':
      return renderThermal58mmHtml(doc);
    case 'THERMAL_80MM':
      return renderThermal80mmHtml(doc);
    case 'A4':
    default:
      return renderA4InvoiceHtml(doc);
  }
}
