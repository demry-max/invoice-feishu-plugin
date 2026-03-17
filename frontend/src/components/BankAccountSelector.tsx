import React, { useEffect, useState } from 'react';
import type { BankAccount } from '../types';
import { fetchBankAccounts } from '../services/api';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export const BankAccountSelector: React.FC<Props> = ({ value, onChange }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBankAccounts()
      .then((data) => {
        setAccounts(data);
        // Auto-select first if none selected
        if (!value && data.length > 0) {
          onChange(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to fetch bank accounts:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <span style={{ fontSize: '12px', color: '#999' }}>加载银行账户...</span>;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select"
      style={{
        width: '100%',
        padding: '6px 10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '13px',
      }}
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label} - {a.bank_name}
        </option>
      ))}
    </select>
  );
};
