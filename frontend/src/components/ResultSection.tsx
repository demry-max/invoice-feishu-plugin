import React, { useEffect, useState } from "react";
import type { GenerateResponse } from "../types";

interface Props {
  result: GenerateResponse | null;
}

async function fetchAndDownload(url: string, filename: string): Promise<void> {
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

async function fetchAndOpen(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  window.open(objUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
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
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Fetch the PDF as a blob and embed it via iframe — bypasses Feishu's
  // domain whitelist and gives the user immediate visual confirmation.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfBlobUrl(null);
    setPdfError(null);

    if (!result?.pdf_url) return;

    (async () => {
      try {
        const res = await fetch(result.pdf_url!);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(createdUrl);
      } catch (err) {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [result?.pdf_url]);

  if (!result) return null;

  const invoiceNo = result.invoice_no;

  const handleOpenHtml = async (): Promise<void> => {
    if (!result.html_url) return;
    setStatus("打开 HTML 中…");
    try {
      await fetchAndOpen(result.html_url);
      setStatus("");
    } catch (err) {
      setStatus(
        `打开失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleDownloadPdf = async (): Promise<void> => {
    if (!result.pdf_url) return;
    setStatus("下载 PDF 中…");
    try {
      await fetchAndDownload(result.pdf_url, `${invoiceNo}.pdf`);
      setStatus("");
    } catch (err) {
      setStatus(
        `下载失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleCopy = async (url: string): Promise<void> => {
    await copyToClipboard(url);
    setStatus("已复制到剪贴板");
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="result-card">
      <div className="result-card-head">
        <div className="result-card-title">
          ✓ 账单已生成 · {invoiceNo}
        </div>
        {status && <div className="result-card-status">{status}</div>}
      </div>

      {/* Inline PDF preview */}
      <div className="result-pdf-frame">
        {pdfBlobUrl ? (
          <iframe
            title={`Invoice ${invoiceNo}`}
            src={pdfBlobUrl}
            className="result-pdf-iframe"
          />
        ) : pdfError ? (
          <div className="result-pdf-fallback result-pdf-error">
            PDF 预览加载失败：{pdfError}
          </div>
        ) : (
          <div className="result-pdf-fallback">PDF 渲染中…</div>
        )}
      </div>

      <div className="result-card-actions">
        <button className="btn btn-primary" onClick={handleDownloadPdf}>
          📥 下载 PDF
        </button>
        <button className="btn btn-secondary" onClick={handleOpenHtml}>
          📄 打开 HTML
        </button>
        {result.pdf_url && (
          <button
            className="btn btn-secondary"
            onClick={() => handleCopy(result.pdf_url!)}
            title={result.pdf_url}
          >
            复制 PDF 链接
          </button>
        )}
      </div>
    </div>
  );
};
