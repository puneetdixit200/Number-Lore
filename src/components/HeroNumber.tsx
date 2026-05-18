import { Hash, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { splitDigits } from "../lib/numbers";

interface HeroNumberProps {
  timestamp: number;
  inputValue: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onDigitClick: (digit: string) => void;
  onQuickPick: (number: string | number) => void;
  onSummon: () => void;
}

export function HeroNumber({
  timestamp,
  inputValue,
  loading,
  onInputChange,
  onDigitClick,
  onQuickPick,
  onSummon,
}: HeroNumberProps) {
  const digits = splitDigits(timestamp);

  return (
    <section className="hero" aria-labelledby="number-lore-title">
      <div className="hero-topline">
        <span className="brand-mark">
          <Hash aria-hidden="true" size={18} />
          Number Lore
        </span>
        <span className="pulse-copy">Live clock. Strange numbers. Better facts.</span>
      </div>

      <h1 id="number-lore-title" className="sr-only">
        Number Lore
      </h1>

      <p className="timestamp-label">Unix Timestamp - live</p>

      <div className="timestamp-wrap" aria-label="Live Unix timestamp">
        {digits.map((digit, index) => (
          <button
            className="digit"
            key={`${timestamp}-${index}`}
            style={{ "--digit-index": index, "--digit-delay": `${index * 0.09}s` } as CSSProperties}
            type="button"
            aria-label={`Inspect digit ${digit}`}
            onClick={() => onDigitClick(digit)}
          >
            {digit}
          </button>
        ))}
      </div>

      <p className="hero-hint">
        Click any digit - or <span>type any number</span> below
      </p>

      <div className="command-strip" aria-label="number controls">
        <label className="number-field">
          <span>Type a number. Hit the burst.</span>
          <input
            aria-label="Number input"
            value={inputValue}
            inputMode="numeric"
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="42"
          />
        </label>
        <button className="primary-action" type="button" onClick={onSummon} disabled={loading}>
          <Sparkles aria-hidden="true" size={18} />
          {loading ? "Reading" : "Summon facts"}
        </button>
      </div>

      <div className="quick-modes" aria-label="quick number picks">
        <button className="mode-btn" type="button" onClick={() => onQuickPick(42)}>
          42
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick(0)}>
          0
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick(1729)}>
          1729
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick(3141592)}>
          3141592
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick(Math.floor(Math.random() * 1000))}>
          Random
        </button>
      </div>
    </section>
  );
}
