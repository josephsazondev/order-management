import { useEffect, useState } from 'react';
import { call } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Field, Alert, Spinner } from '../../components/ui.jsx';
import { resolveLogoUrl } from '../../lib/image.js';

const EMPTY_ACCOUNT = { method: '', account_name: '', account_number: '' };

export default function InvoiceSettings() {
  const { reloadSettings, settings } = useAuth();
  const methodOptions = settings.payment_methods || [];
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    call('getSettings').then((res) => {
      if (res.ok) {
        setForm({
          business_name: res.data.business_name || '',
          business_logo: res.data.business_logo || '',
          business_phone: res.data.business_phone || '',
          invoice_start_number: res.data.invoice_start_number ?? 1,
          payment_accounts: (res.data.payment_accounts || []).map((a) => ({ ...EMPTY_ACCOUNT, ...a })),
        });
      } else setError(res.error);
    });
  }, []);

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));
  const setAccount = (i, f, v) => setForm((s) => ({
    ...s,
    payment_accounts: s.payment_accounts.map((a, idx) => (idx === i ? { ...a, [f]: v } : a)),
  }));
  const addAccount = () => setForm((s) => ({ ...s, payment_accounts: [...s.payment_accounts, { ...EMPTY_ACCOUNT }] }));
  const removeAccount = (i) => setForm((s) => ({ ...s, payment_accounts: s.payment_accounts.filter((_, idx) => idx !== i) }));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setError('');
    const res = await call('updateInvoiceSettings', {
      business_name: form.business_name,
      business_logo: form.business_logo,
      business_phone: form.business_phone,
      invoice_start_number: Number(form.invoice_start_number),
      payment_accounts: form.payment_accounts,
    });
    setBusy(false);
    if (res.ok) { setMsg('Invoice settings saved.'); reloadSettings(); }
    else setError(res.error);
  }

  if (!form) return <div className="page"><Spinner /></div>;

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Invoice Settings</h1>
          <p className="muted">Branding and payment accounts shown on every generated invoice.</p>
        </div>
      </div>

      <Alert tone="info" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>

      <form className="card form" onSubmit={save}>
        <Field label="Business name" hint="Shown as the invoice header">
          <input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
        </Field>
        <Field label="Business phone" hint="Shown under the business name">
          <input value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} placeholder="0945-588-0890" />
        </Field>
        <Field label="Business logo URL" hint="Paste an image URL or a Google Drive share link (file must be shared “Anyone with the link”). Previewed below.">
          <input value={form.business_logo} onChange={(e) => set('business_logo', e.target.value)} placeholder="https://…/logo.png or Google Drive link" />
        </Field>
        {form.business_logo && (
          <div className="logo-preview">
            <img src={resolveLogoUrl(form.business_logo)} alt="Logo preview"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}

        <Field label="Starting invoice number" hint="The next invoice continues from here — set this to match your previous invoice generator. Numbers only.">
          <input type="number" min="1" step="1" value={form.invoice_start_number}
            onChange={(e) => set('invoice_start_number', e.target.value)} />
        </Field>

        <div className="field">
          <span>Payment accounts</span>
          <small className="hint">Shown in the invoice's Payment Info section. Add one row per method (BPI, GCash, etc.).</small>
        </div>

        {form.payment_accounts.length === 0 && (
          <div className="empty" style={{ marginBottom: 12 }}>No payment accounts yet. Add one below.</div>
        )}

        {form.payment_accounts.map((a, i) => (
          <div className="account-row" key={i}>
            <div className="grid-2">
              <Field label="Payment method" hint="e.g. BPI, GCash">
                <input list="invoice-method-options" value={a.method} onChange={(e) => setAccount(i, 'method', e.target.value)} placeholder="GCash" />
              </Field>
              <Field label="Account name">
                <input value={a.account_name} onChange={(e) => setAccount(i, 'account_name', e.target.value)} />
              </Field>
            </div>
            <Field label="Account number">
              <input value={a.account_number} onChange={(e) => setAccount(i, 'account_number', e.target.value)} />
            </Field>
            <button type="button" className="link-btn danger small" onClick={() => removeAccount(i)}>Remove account</button>
          </div>
        ))}
        <datalist id="invoice-method-options">
          {methodOptions.map((m) => <option key={m} value={m} />)}
        </datalist>

        <div className="row gap">
          <button type="button" className="btn ghost" onClick={addAccount}>+ Add payment account</button>
          <button className="btn primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save invoice settings'}</button>
        </div>
      </form>
    </div>
  );
}
