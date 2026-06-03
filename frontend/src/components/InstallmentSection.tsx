import React from "react";
import type { InstallmentInfo } from "../types";

type Overrides = {
  first_payment_ratio?: number;
  final_payment_ratio?: number;
  first_payment_amount?: number;
  final_payment_amount?: number;
  final_payment_business_days?: number;
};

interface Props {
  showInstallment: boolean;
  onShowInstallmentChange: (v: boolean) => void;
  /** Formula-computed defaults from the preview response. */
  defaults?: InstallmentInfo;
  overrides: Overrides;
  onOverridesChange: (next: Overrides) => void;
  /** Currency symbol (e.g. ¥ / $ / ₱ / ฿) for the amount inputs. */
  currency: string;
}

/**
 * Per spec req 4 — Installment payment block.
 *
 * Renders the "是否展示分期信息 / Show installment info" toggle and, when on,
 * a row of five editable fields (first/final ratio, first/final amount,
 * business-day window). Empty fields fall back to the formula-computed
 * default from the preview.
 */
export const InstallmentSection: React.FC<Props> = ({
  showInstallment,
  onShowInstallmentChange,
  defaults,
  overrides,
  onOverridesChange,
  currency,
}) => {
  const set = <K extends keyof Overrides>(key: K, value: Overrides[K]): void => {
    onOverridesChange({ ...overrides, [key]: value });
  };

  // Display values: override → default → fallback.
  const firstRatioPct = pickRatioAsPct(
    overrides.first_payment_ratio,
    defaults?.first_payment_ratio,
  );
  const finalRatioPct = pickRatioAsPct(
    overrides.final_payment_ratio,
    defaults?.final_payment_ratio,
  );
  const firstAmount = pickAmount(
    overrides.first_payment_amount,
    defaults?.first_payment_amount,
  );
  const finalAmount = pickAmount(
    overrides.final_payment_amount,
    defaults?.final_payment_amount,
  );
  const businessDays = pickNumber(
    overrides.final_payment_business_days,
    defaults?.final_payment_business_days,
    30,
  );

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "#666",
    marginBottom: "3px",
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "4px 6px",
    fontSize: "12px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    boxSizing: "border-box",
  };

  return (
    <div>
      <label
        style={{
          fontSize: "12px",
          color: "#666",
          marginBottom: "4px",
          display: "block",
        }}
      >
        是否展示分期信息 / Show installment info
      </label>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          className={`btn ${!showInstallment ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onShowInstallmentChange(false)}
        >
          不展示 / Do not display
        </button>
        <button
          className={`btn ${showInstallment ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onShowInstallmentChange(true)}
        >
          展示 / Display
        </button>
      </div>
      {showInstallment && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "#FAFAF7",
            border: "1px solid #EEE",
            borderRadius: 6,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>首款比例 / First Payment Ratio (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={firstRatioPct}
              style={inputStyle}
              onChange={(e) => {
                const pct = Number(e.target.value);
                set(
                  "first_payment_ratio",
                  Number.isFinite(pct) ? pct / 100 : undefined,
                );
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>尾款比例 / Final Payment Ratio (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={finalRatioPct}
              style={inputStyle}
              onChange={(e) => {
                const pct = Number(e.target.value);
                set(
                  "final_payment_ratio",
                  Number.isFinite(pct) ? pct / 100 : undefined,
                );
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>
              首款金额 / First Payment Amount ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={firstAmount}
              style={inputStyle}
              onChange={(e) => {
                const v = Number(e.target.value);
                set(
                  "first_payment_amount",
                  Number.isFinite(v) ? v : undefined,
                );
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>
              尾款金额 / Final Payment Amount ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={finalAmount}
              style={inputStyle}
              onChange={(e) => {
                const v = Number(e.target.value);
                set(
                  "final_payment_amount",
                  Number.isFinite(v) ? v : undefined,
                );
              }}
            />
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={labelStyle}>
              尾款支付期限（工作日）/ Final Payment Window (business days)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={businessDays}
              style={{ ...inputStyle, width: "120px" }}
              onChange={(e) => {
                const v = Number(e.target.value);
                set(
                  "final_payment_business_days",
                  Number.isFinite(v) && v > 0 ? Math.round(v) : undefined,
                );
              }}
            />
            <span style={{ fontSize: "11px", color: "#999", marginLeft: 8 }}>
              默认 / Default: 30
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

function pickRatioAsPct(
  override: number | undefined,
  fallback: number | undefined,
): string {
  const r = typeof override === "number" ? override : fallback;
  if (typeof r !== "number" || !Number.isFinite(r)) return "";
  return (r * 100).toFixed(2).replace(/\.?0+$/, "");
}

function pickAmount(
  override: number | undefined,
  fallback: number | undefined,
): string {
  const v = typeof override === "number" ? override : fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  return v.toFixed(2);
}

function pickNumber(
  override: number | undefined,
  fallback: number | undefined,
  hardDefault: number,
): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return hardDefault;
}
