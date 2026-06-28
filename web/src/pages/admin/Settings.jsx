import { useEffect, useState } from 'react';
import { call } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Field, Alert, Spinner } from '../../components/ui.jsx';

export default function Settings() {
  const { reloadSettings, can } = useAuth();
  const canUpdate = can('settings', 'update'); // settings:read = view; settings:update = save
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    call('getSettings').then((res) => {
      if (res.ok) setForm({ ...res.data, payment_methods: (res.data.payment_methods || []).join(', ') });
      else setError(res.error);
    });
  }, []);

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setError('');
    const payload = {
      business_name: form.business_name,
      currency: form.currency,
      timezone: form.timezone,
      overdue_days: Number(form.overdue_days),
      payment_methods: form.payment_methods.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const res = await call('updateSettings', payload);
    setBusy(false);
    if (res.ok) { setMsg('Settings saved.'); reloadSettings(); }
    else setError(res.error);
  }

  if (!form) return <div className="page"><Spinner /></div>;

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>System Settings</h1>
          <p className="muted">App-wide configuration. Admin-only; never the product catalog or its prices.</p>
        </div>
      </div>

      <Alert tone="info" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>

      <form className="card form" onSubmit={save}>
        <fieldset disabled={!canUpdate} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Business name" hint="Shown in the app header">
            <input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="Currency"><input value={form.currency} onChange={(e) => set('currency', e.target.value)} /></Field>
            <Field label="Timezone"><input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} /></Field>
          </div>
          <Field label="Overdue threshold (days)" hint="Days after a week before an unpaid subscription is flagged overdue">
            <input type="number" min="0" value={form.overdue_days} onChange={(e) => set('overdue_days', e.target.value)} />
          </Field>
          <Field label="Payment methods" hint="Comma-separated; shown in the owner's record-payment form">
            <input value={form.payment_methods} onChange={(e) => set('payment_methods', e.target.value)} />
          </Field>
        </fieldset>
        {canUpdate && (
          <div className="row gap">
            <button className="btn primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save settings'}</button>
          </div>
        )}
      </form>
    </div>
  );
}
