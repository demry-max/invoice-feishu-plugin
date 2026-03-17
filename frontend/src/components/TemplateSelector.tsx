import React from 'react';
import type { BrandTemplateId } from '../types';

interface Props {
  value: BrandTemplateId;
  onChange: (id: BrandTemplateId) => void;
}

const TEMPLATES: { id: BrandTemplateId; label: string; color: string }[] = [
  { id: 'feilong', label: '菲龙咨询', color: '#c0392b' },
  { id: 'starlight', label: '星耀财税', color: '#D4A017' },
];

export const TemplateSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="template-selector" style={{ display: 'flex', gap: '8px' }}>
      {TEMPLATES.map((t) => {
        const isActive = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: '8px 16px',
              border: `2px solid ${isActive ? t.color : '#ddd'}`,
              borderRadius: '6px',
              background: isActive ? t.color : '#fff',
              color: isActive ? '#fff' : '#333',
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: t.color,
                marginRight: '6px',
                border: isActive ? '2px solid #fff' : 'none',
              }}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
};
