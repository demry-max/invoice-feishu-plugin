import React from 'react';
import type { CompanyConfig } from '../types';

interface Props {
  config: CompanyConfig;
  onChange: (config: CompanyConfig) => void;
}

export const CompanyInfoSection: React.FC<Props> = ({ config, onChange }) => {
  const update = (field: keyof CompanyConfig, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="section">
      <h3 className="section-title">公司信息 / Company Info</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>公司名称 / Company Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>地址行1 / Address Line 1</label>
          <input
            type="text"
            value={config.address_line1}
            onChange={(e) => update('address_line1', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>地址行2 / Address Line 2</label>
          <input
            type="text"
            value={config.address_line2}
            onChange={(e) => update('address_line2', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>邮箱 / Email</label>
          <input
            type="text"
            value={config.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Logo URL</label>
          <input
            type="text"
            value={config.logo_url}
            onChange={(e) => update('logo_url', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
};
