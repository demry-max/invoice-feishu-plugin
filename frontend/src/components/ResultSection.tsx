import React, { useState } from "react";
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

  if (!result) return null;

  const invoiceNo = result.invoice_no;

  const handleOpenHtml = async (): Promise<void> => {
    if (!result.html_url) return;
    setStatus("打开 HTML 中… / Opening HTML…");
    try {
      await fetchAndOpen(result.html_url);
      setStatus("");
    } catch (err) {
      setStatus(
        `打开失败 / Open failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleDownloadPdf = async (): Promise<void> => {
    if (!result.pdf_url) return;
    setStatus("下载 PDF 中… / Downloading PDF…");
    try {
      await fetchAndDownload(result.pdf_url, `${invoiceNo}.pdf`);
      setStatus("");
    } catch (err) {
      setStatus(
        `下载失败 / Download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleCopy = async (url: string): Promise<void> => {
    await copyToClipboard(url);
    setStatus("已复制到剪贴板 / Copied to clipboard");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleDownloadWord = async (): Promise<void> => {
    if (!result.word_url) return;
    setStatus("下载 Word 中… / Downloading Word…");
    try {
      await fetchAndDownload(result.word_url, `${invoiceNo}.docx`);
      setStatus("");
    } catch (err) {
      setStatus(
        `下载失败 / Download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <div className="result-card">
      <div className="result-card-head">
        <div className="result-card-title">
          ✓ 账单已生成 / Invoice Generated · {invoiceNo}
        </div>
        {status && <div className="result-card-status">{status}</div>}
      </div>

      <div className="result-card-actions">
        <button className="btn btn-primary" onClick={handleDownloadPdf}>
          📥 下载 PDF / Download PDF
        </button>
        <button className="btn btn-secondary" onClick={handleOpenHtml}>
          📄 打开 HTML / Open HTML
        </button>
        {result.word_url && (
          <button
            className="btn btn-secondary"
            onClick={handleDownloadWord}
            title={result.word_url}
          >
            📝 下载 Word / Download Word
          </button>
        )}
        {result.pdf_url && (
          <button
            className="btn btn-secondary"
            onClick={() => handleCopy(result.pdf_url!)}
            title={result.pdf_url}
          >
            复制 PDF 链接 / Copy PDF Link
          </button>
        )}
      </div>
    </div>
  );
};
