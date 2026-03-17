import React from 'react';
import type { GenerateResponse } from '../types';

interface Props {
  result: GenerateResponse | null;
}

export const ResultSection: React.FC<Props> = ({ result }) => {
  if (!result) return null;

  return (
    <div className="section result-section" style={{
      border: '2px solid #52c41a',
      background: '#f6ffed',
      padding: '16px',
      marginTop: '16px',
      borderRadius: '8px',
    }}>
      <h3 className="section-title success-title" style={{ color: '#52c41a' }}>
        ✅ 账单生成成功
      </h3>
      <div className="result-grid">
        <div className="result-item" style={{ marginBottom: '8px' }}>
          <span className="result-label">账单编号: </span>
          <span className="result-value" style={{ fontWeight: 'bold' }}>
            {result.invoice_no}
          </span>
        </div>

        {result.html_url ? (
          <div className="result-item" style={{ marginBottom: '8px' }}>
            <a
              href={result.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="result-link"
              style={{ color: '#1890ff', textDecoration: 'underline' }}
            >
              📄 查看 HTML 账单
            </a>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', wordBreak: 'break-all' }}>
              {result.html_url}
            </div>
          </div>
        ) : (
          <div style={{ color: '#ff4d4f' }}>⚠️ html_url 为空</div>
        )}

        {result.pdf_url ? (
          <div className="result-item" style={{ marginBottom: '8px' }}>
            <a
              href={result.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="result-link"
              style={{ color: '#1890ff', textDecoration: 'underline' }}
            >
              📥 下载 PDF 账单
            </a>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', wordBreak: 'break-all' }}>
              {result.pdf_url}
            </div>
          </div>
        ) : (
          <div style={{ color: '#ff4d4f' }}>⚠️ pdf_url 为空</div>
        )}
      </div>
    </div>
  );
};
