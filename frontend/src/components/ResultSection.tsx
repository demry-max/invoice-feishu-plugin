import React, { useState } from "react";
import type { GenerateResponse } from "../types";

interface Props {
  result: GenerateResponse | null;
}

async function fetchAndDownload(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}

async function fetchAndOpen(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  // Open the blob URL in a new tab. Most browsers allow this from a click.
  window.open(objUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export const ResultSection: React.FC<Props> = ({ result }) => {
  const [status, setStatus] = useState<string>("");

  if (!result) return null;

  const invoiceNo = result.invoice_no;

  const handleOpenHtml = async () => {
    if (!result.html_url) return;
    setStatus("打开 HTML 中…");
    try {
      await fetchAndOpen(result.html_url);
      setStatus("");
    } catch (err) {
      setStatus(`打开失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result.pdf_url) return;
    setStatus("下载 PDF 中…");
    try {
      await fetchAndDownload(result.pdf_url, `${invoiceNo}.pdf`);
      setStatus("");
    } catch (err) {
      setStatus(`下载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCopy = async (url: string) => {
    await copyToClipboard(url);
    setStatus("已复制到剪贴板");
    setTimeout(() => setStatus(""), 2000);
  };

  const linkStyle: React.CSSProperties = {
    color: "#1890ff",
    textDecoration: "underline",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
  };

  const smallBtnStyle: React.CSSProperties = {
    marginLeft: 8,
    fontSize: 12,
    padding: "2px 8px",
    border: "1px solid #d9d9d9",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
  };

  return (
    <div
      className="section result-section"
      style={{
        border: "2px solid #52c41a",
        background: "#f6ffed",
        padding: "16px",
        marginTop: "16px",
        borderRadius: "8px",
      }}
    >
      <h3 className="section-title success-title" style={{ color: "#52c41a" }}>
        ✅ 账单生成成功
      </h3>
      <div className="result-grid">
        <div className="result-item" style={{ marginBottom: "8px" }}>
          <span className="result-label">账单编号: </span>
          <span className="result-value" style={{ fontWeight: "bold" }}>
            {invoiceNo}
          </span>
        </div>

        {result.html_url ? (
          <div className="result-item" style={{ marginBottom: "8px" }}>
            <button style={linkStyle} onClick={handleOpenHtml}>
              📄 查看 HTML 账单
            </button>
            <button
              style={smallBtnStyle}
              onClick={() => handleCopy(result.html_url!)}
            >
              复制链接
            </button>
            <div
              style={{
                fontSize: "12px",
                color: "#999",
                marginTop: "4px",
                wordBreak: "break-all",
              }}
            >
              {result.html_url}
            </div>
          </div>
        ) : (
          <div style={{ color: "#ff4d4f" }}>⚠️ html_url 为空</div>
        )}

        {result.pdf_url ? (
          <div className="result-item" style={{ marginBottom: "8px" }}>
            <button style={linkStyle} onClick={handleDownloadPdf}>
              📥 下载 PDF 账单
            </button>
            <button
              style={smallBtnStyle}
              onClick={() => handleCopy(result.pdf_url!)}
            >
              复制链接
            </button>
            <div
              style={{
                fontSize: "12px",
                color: "#999",
                marginTop: "4px",
                wordBreak: "break-all",
              }}
            >
              {result.pdf_url}
            </div>
          </div>
        ) : (
          <div style={{ color: "#ff4d4f" }}>⚠️ pdf_url 为空</div>
        )}

        {status && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
