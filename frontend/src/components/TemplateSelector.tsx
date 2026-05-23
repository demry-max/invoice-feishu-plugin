import React from "react";
import type { BrandTemplateId } from "../types";

interface Template {
  id: BrandTemplateId;
  zhName: string;
  enName: string;
  accent: string;
}

interface Props {
  value: BrandTemplateId;
  onChange: (id: BrandTemplateId) => void;
}

const TEMPLATES: Template[] = [
  {
    id: "feilong",
    zhName: "菲龙咨询",
    enName: "Feilong Consulting",
    accent: "#c0392b",
  },
  {
    id: "starlight",
    zhName: "星耀财税",
    enName: "Star Shine Taxation",
    accent: "#D4A017",
  },
];

/**
 * Brand-template selector — small card previews that hint at the invoice layout
 * (accent header bar + mock data lines) rather than just a color dot.
 */
export const TemplateSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="tpl-grid">
      {TEMPLATES.map((t) => {
        const isActive = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`tpl-card ${isActive ? "tpl-card-active" : ""}`}
            style={{
              border: `2px solid ${isActive ? t.accent : "#e5e7eb"}`,
            }}
            aria-pressed={isActive}
          >
            {/* Mini invoice preview */}
            <div className="tpl-mini">
              <div
                className="tpl-mini-bar"
                style={{ background: t.accent }}
              />
              <div className="tpl-mini-content">
                <div className="tpl-mini-h"></div>
                <div className="tpl-mini-line"></div>
                <div className="tpl-mini-line tpl-mini-line-short"></div>
                <div
                  className="tpl-mini-grand"
                  style={{ color: t.accent }}
                ></div>
              </div>
            </div>
            <div className="tpl-card-label">
              <div className="tpl-card-zh">{t.zhName}</div>
              <div className="tpl-card-en">{t.enName}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
