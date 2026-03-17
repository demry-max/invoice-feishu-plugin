import React from 'react';
import type { TaxMode } from '../types';

interface Props {
  value: TaxMode;
  onChange: (mode: TaxMode) => void;
}

const MODES: { id: TaxMode; label: string }[] = [
  { id: 'tax_excluded', label: '不含税 (+ VAT)' },
  { id: 'tax_included', label: '含税 (含 VAT)' },
];

export const TaxModeToggle: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {MODES.map((m) => {
        const isActive = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            style={{
              padding: '6px 14px',
              border: `1px solid ${isActive ? '#1890ff' : '#ddd'}`,
              borderRadius: '4px',
              background: isActive ? '#e6f7ff' : '#fff',
              color: isActive ? '#1890ff' : '#666',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
};
