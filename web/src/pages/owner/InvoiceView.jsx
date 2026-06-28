import { useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Spinner, Alert, Empty } from '../../components/ui.jsx';
import { formatPHP, formatDateLong } from '../../lib/format.js';
import { resolveLogoUrl, safeFileName } from '../../lib/image.js';
import { nodeToPng } from '../../lib/exportImage.js';

export default function InvoiceView() {
  const { invoiceId } = useParams();
  const { settings, can } = useAuth();
  const navigate = useNavigate();
  const canDelete = can('invoices', 'delete');
  const { data: inv, loading, error } = useApi('getInvoice', { invoice_id: invoiceId }, [invoiceId]);
  const docRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportErr, setExportErr] = useState('');

  async function deleteInvoice() {
    if (!confirm(`Delete ${inv.invoice_id} (${inv.customer_name})? It will be hidden everywhere but kept in the audit log, and its number won't be reused.`)) return;
    const reason = prompt('Reason for deletion (optional):') || '';
    const res = await call('deleteInvoice', { invoice_id: inv.invoice_id, reason });
    if (res.ok) navigate('/invoices');
    else setExportErr(res.error);
  }

  async function downloadImage() {
    if (!docRef.current) return;
    setBusy(true); setExportMsg(''); setExportErr('');
    const fileName = `${safeFileName(inv.invoice_id, 'invoice')} - ${safeFileName(inv.customer_name, 'customer')}.png`;
    try {
      const { dataUrl, droppedImages } = await nodeToPng(docRef.current, { pixelRatio: 2, background: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
      if (droppedImages > 0) {
        setExportMsg('Downloaded without the logo — the logo image could not be loaded for export (cross-origin). Use a directly-hosted image URL, or a public Google Drive image.');
      }
    } catch (e) {
      setExportErr('Could not export the invoice image: ' + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><Alert tone="error">{error}</Alert><Link className="btn ghost" to="/invoices">← Back to invoices</Link></div>;
  if (!inv) return <div className="page"><Empty>Invoice not found.</Empty></div>;

  const accounts = settings.payment_accounts || [];
  const businessName = settings.business_name || 'Business';
  const total = inv.amount;

  return (
    <div className="page invoice-page">
      <div className="invoice-actions no-print">
        <Link className="btn ghost" to="/invoices">← Back</Link>
        <div className="row gap">
          {canDelete && <button className="btn ghost danger" onClick={deleteInvoice}>Delete</button>}
          <button className="btn ghost" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="btn primary" disabled={busy} onClick={downloadImage}>{busy ? 'Exporting…' : 'Download image (PNG)'}</button>
        </div>
      </div>

      <Alert tone="info" onClose={() => setExportMsg('')}>{exportMsg}</Alert>
      <Alert tone="error" onClose={() => setExportErr('')}>{exportErr}</Alert>

      <div className="invoice-doc" ref={docRef}>
        <div className="invoice-top">
          <div className="invoice-brand">
            {settings.business_logo
              ? <img className="invoice-logo" src={resolveLogoUrl(settings.business_logo)} alt={businessName}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              : null}
            <h2 className="invoice-business">{businessName}</h2>
            {settings.business_phone && <div className="invoice-phone">{settings.business_phone}</div>}
          </div>
          <div className="invoice-meta">
            <div className="invoice-title">Invoice</div>
            <div className="invoice-number"># {inv.invoice_id}</div>
          </div>
        </div>

        <div className="invoice-parties">
          <div className="invoice-billto">
            <strong>{inv.customer_name}</strong>
            {inv.customer_address && <div className="muted">{inv.customer_address}</div>}
          </div>
          <div className="invoice-date">
            <span className="muted">Invoice Date :</span>
            <span>{formatDateLong(inv.invoice_date)}</span>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div>{inv.description}</div>
                {inv.line_note && <div className="invoice-line-note">{inv.line_note}</div>}
              </td>
              <td className="num">{Number(inv.quantity).toFixed(2)}</td>
              <td className="num">{formatPHP(inv.rate)}</td>
              <td className="num">{formatPHP(inv.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>Sub Total</span>
            <span>{formatPHP(inv.amount)}</span>
          </div>
          <div className="invoice-total-row grand">
            <span>Total</span>
            <span>{(inv.currency || 'PHP')}{Number(total).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="invoice-payinfo">
          <h3>PAYMENT INFO</h3>
          {accounts.length === 0 ? (
            <div className="muted small no-print">No payment accounts configured. Add them in Invoice Settings.</div>
          ) : (
            <div className="invoice-accounts">
              {accounts.map((a, i) => (
                <div className="invoice-account" key={i}>
                  <div className="invoice-account-method">{a.method}</div>
                  {a.account_name && <div>{a.account_name}</div>}
                  {a.account_number && <div className="invoice-account-number">{a.account_number}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {inv.notes && <div className="invoice-notes muted">{inv.notes}</div>}
      </div>
    </div>
  );
}
