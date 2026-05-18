import { Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { splitDigits } from "../lib/numbers";

interface HeroNumberProps {
  timestamp: string;
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
      <p className="pulse-copy">Dates only. Stranger history. Cleaner sources.</p>

      <h1 id="number-lore-title" className="hero-title">
        Number Lore
      </h1>

      <p className="timestamp-label">Today - date code</p>

      <div className="timestamp-wrap" aria-label="Live date code">
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
        Click any digit - or <span>type any date</span> below
      </p>

      <div className="command-strip" aria-label="date controls">
        <label className="number-field">
          <span>Type a date. Hit the burst.</span>
          <input
            aria-label="Date input"
            value={inputValue}
            inputMode="text"
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="5/18"
          />
        </label>
        <button className="primary-action" type="button" onClick={onSummon} disabled={loading}>
          <Sparkles aria-hidden="true" size={18} />
          {loading ? "Reading" : "Summon history"}
        </button>
      </div>

      <div className="quick-modes" aria-label="quick date picks">
        <button className="mode-btn" type="button" onClick={() => onQuickPick(inputValue)}>
          Today
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick("5/18")}>
          5/18
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick("7/20")}>
          7/20
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick("1/1")}>
          1/1
        </button>
        <button className="mode-btn" type="button" onClick={() => onQuickPick(`${Math.floor(Math.random() * 12) + 1}/${Math.floor(Math.random() * 28) + 1}`)}>
          Random
        </button>
      </div>
    </section>
  );
}
