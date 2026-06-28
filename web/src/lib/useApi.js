import { useCallback, useEffect, useState } from 'react';
import { call } from '../api/client.js';

// Fetch `action` on mount and whenever `deps` change. Returns { data, loading, error, reload }.
export function useApi(action, payload, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const payloadKey = JSON.stringify(payload || {});

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await call(action, payload);
    if (res.ok) setData(res.data);
    else setError(res.error || 'Failed to load');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, payloadKey]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { data, loading, error, reload, setData };
}
