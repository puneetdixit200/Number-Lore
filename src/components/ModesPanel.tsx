import { Cake, CalendarDays, Dices, Swords } from "lucide-react";
import type { BattleResult } from "../lib/numbers";

export type Mode = "daily" | "battle" | "birthday";

interface ModesPanelProps {
  activeMode: Mode;
  dailyNumber: string;
  loading: boolean;
  battleLeft: string;
  battleRight: string;
  birthdayDate: string;
  birthdayTime: string;
  birthdayStatus: string;
  battleResult: BattleResult | null;
  onModeChange: (mode: Mode) => void;
  onDaily: () => void;
  onBattleLeftChange: (value: string) => void;
  onBattleRightChange: (value: string) => void;
  onRunBattle: () => void;
  onBirthdayDateChange: (value: string) => void;
  onBirthdayTimeChange: (value: string) => void;
  onDecodeBirthday: () => void;
}

export function ModesPanel({
  activeMode,
  dailyNumber,
  loading,
  battleLeft,
  battleRight,
  birthdayDate,
  birthdayTime,
  birthdayStatus,
  battleResult,
  onModeChange,
  onDaily,
  onBattleLeftChange,
  onBattleRightChange,
  onRunBattle,
  onBirthdayDateChange,
  onBirthdayTimeChange,
  onDecodeBirthday,
}: ModesPanelProps) {
  return (
    <section className="modes" aria-label="date modes">
      <div className="mode-tabs" role="tablist" aria-label="Date modes">
        <button
          type="button"
          className={activeMode === "daily" ? "active" : ""}
          onClick={() => onModeChange("daily")}
        >
          <CalendarDays aria-hidden="true" size={18} />
          Today
        </button>
        <button
          type="button"
          className={activeMode === "battle" ? "active" : ""}
          onClick={() => onModeChange("battle")}
        >
          <Swords aria-hidden="true" size={18} />
          Year scan
        </button>
        <button
          type="button"
          className={activeMode === "birthday" ? "active" : ""}
          onClick={() => onModeChange("birthday")}
        >
          <Cake aria-hidden="true" size={18} />
          Birth date
        </button>
      </div>

      {activeMode === "daily" ? (
        <div className="mode-panel">
          <div>
            <span className="panel-kicker">today's date</span>
            <strong>{dailyNumber}</strong>
          </div>
          <button type="button" onClick={onDaily} disabled={loading}>
            <Dices aria-hidden="true" size={18} />
            Read today
          </button>
        </div>
      ) : null}

      {activeMode === "battle" ? (
        <div className="mode-panel battle-panel">
          <label>
            <span>First year</span>
            <input
              aria-label="First year"
              value={battleLeft}
              inputMode="numeric"
              onChange={(event) => onBattleLeftChange(event.target.value)}
            />
          </label>
          <label>
            <span>Second year</span>
            <input
              aria-label="Second year"
              value={battleRight}
              inputMode="numeric"
              onChange={(event) => onBattleRightChange(event.target.value)}
            />
          </label>
          <button type="button" onClick={onRunBattle} disabled={loading}>
            <Swords aria-hidden="true" size={18} />
            Compare years
          </button>
          {battleResult ? (
            <div className="battle-result" aria-live="polite">
              <span>Winner: {battleResult.winner === "tie" ? "tie" : battleResult[battleResult.winner].value}</span>
              <div className="score-row">
                <span>{battleResult.left.value}</span>
                <meter min="0" max="160" value={battleResult.left.score} />
                <b>{battleResult.left.score}</b>
              </div>
              <div className="score-row">
                <span>{battleResult.right.value}</span>
                <meter min="0" max="160" value={battleResult.right.score} />
                <b>{battleResult.right.score}</b>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeMode === "birthday" ? (
        <div className="mode-panel birthday-panel">
          <label>
            <span>Date</span>
            <input
              aria-label="Birthday date"
              type="date"
              value={birthdayDate}
              onChange={(event) => onBirthdayDateChange(event.target.value)}
            />
          </label>
          <label>
            <span>Time</span>
            <input
              aria-label="Birthday time"
              type="time"
              value={birthdayTime}
              onChange={(event) => onBirthdayTimeChange(event.target.value)}
            />
          </label>
          <button type="button" onClick={onDecodeBirthday} disabled={loading}>
            <Cake aria-hidden="true" size={18} />
            Decode birthday
          </button>
          {birthdayStatus ? (
            <p className="status-line" aria-live="polite">
              {birthdayStatus}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
