import React, { useEffect, useState } from "react";
import type { BankAccount } from "../types";
import { fetchBankAccounts } from "../services/api";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/**
 * Fetches the list of bank accounts once on mount. Earlier versions
 * silently swallowed fetch errors and rendered an empty `<select>` with
 * no indication of what went wrong — a confusing failure mode for the
 * end user. This implementation surfaces every state explicitly:
 * loading, error (with retry), empty, and the normal list.
 */
export const BankAccountSelector: React.FC<Props> = ({ value, onChange }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBankAccounts()
      .then((data) => {
        if (cancelled) return;
        setAccounts(data);
        // Auto-select first when nothing is selected, or when the persisted
        // value points at an account that no longer exists in the list.
        const valueIsKnown = !!value && data.some((a) => a.id === value);
        if (!valueIsKnown && data.length > 0) {
          onChange(data[0].id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  if (loading) {
    return (
      <span style={{ fontSize: "12px", color: "#999" }}>
        加载银行账户… / Loading bank accounts…
      </span>
    );
  }

  if (error) {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "#b85c00",
          padding: "6px 0",
        }}
      >
        银行账户加载失败 / Bank accounts failed to load: {error}{" "}
        <button
          type="button"
          onClick={() => setRetryCount((n) => n + 1)}
          style={{
            background: "none",
            border: "none",
            color: "#1d6cf2",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            marginLeft: 4,
          }}
        >
          重试 / Retry
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <span style={{ fontSize: "12px", color: "#b85c00" }}>
        无可用银行账户 / No bank accounts available
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select"
      style={{
        width: "100%",
        padding: "6px 10px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        fontSize: "13px",
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
