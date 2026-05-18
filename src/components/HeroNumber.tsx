import { Hash, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { splitDigits } from "../lib/numbers";

interface HeroNumberProps {
  timestamp: number;
  inputValue: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onDigitClick: (digit: string) => void;
  onSummon: () => void;
}

export function HeroNumber({
  timestamp,
  inputValue,
  loading,
  onInputChange,
  onDigitClick,
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
        <span className="pulse-copy">Unix clock. Live feed. No ceremony.</span>
      </div>

      <h1 id="number-lore-title" className="sr-only">
        Number Lore
      </h1>

      <div className="timestamp-wrap" aria-label="Live Unix timestamp">
        {digits.map((digit, index) => (
          <button
            className="digit"
            key={`${timestamp}-${index}`}
            style={{ "--digit-index": index } as CSSProperties}
            type="button"
            aria-label={`Inspect digit ${digit}`}
            onClick={() => onDigitClick(digit)}
          >
            {digit}
          </button>
        ))}
      </div>

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
    </section>
  );
}
