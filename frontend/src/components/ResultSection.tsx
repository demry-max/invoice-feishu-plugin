import React from 'react';
import type { GenerateResponse } from '../types';

interface Props {
  result: GenerateResponse | null;
}

export const ResultSection: React.FC<Props> = ({ result }) => {
  if (!result) return null;

  return (
    <div className="section result-section">
      <h3 className="section-title success-title">账单生成成功</h3>
      <div className="result-grid">
        <div className="result-item">
          <span className="result-label">账单编号</span>
          <span className="result-value">{result.invoice_no}</span>
        </div>
        <div className="result-item">
          <a
            href={result.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="result-link"
          >
            查看 HTML 账单
          </a>
        </div>
        <div className="result-item">
          <a
            href={result.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="result-link"
          >
            下载 PDF 账单
          </a>
        </div>
      </div>
    </div>
  );
};
