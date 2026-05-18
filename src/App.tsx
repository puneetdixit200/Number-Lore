import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { FactDeck } from "./components/FactDeck";
import { HeroNumber } from "./components/HeroNumber";
import { type Mode, ModesPanel } from "./components/ModesPanel";
import { NumberRain } from "./components/NumberRain";
import { Timeline } from "./components/Timeline";
import {
  createRainParticles,
  extractBirthdayNumbers,
  getDailyNumber,
  getUnixTimestamp,
  sanitizeNumberInput,
  scoreBattle,
  type BattleResult,
  type RainParticle,
} from "./lib/numbers";
import {
  createFallbackFact,
  fetchBattleFacts,
  fetchDailyFacts,
  fetchFactBurst,
  fetchFactsForBirthday,
  type FactCard,
} from "./services/facts";
import "./styles.css";

export default function App() {
  const [timestamp, setTimestamp] = useState(() => getUnixTimestamp());
  const [inputValue, setInputValue] = useState(() => String(getUnixTimestamp()));
  const [inputTouched, setInputTouched] = useState(false);
  const [cards, setCards] = useState<FactCard[]>([]);
  const [particles, setParticles] = useState<RainParticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>("daily");
  const [battleLeft, setBattleLeft] = useState("42");
  const [battleRight, setBattleRight] = useState("7");
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [birthdayDate, setBirthdayDate] = useState("");
  const [birthdayTime, setBirthdayTime] = useState("");
  const [birthdayStatus, setBirthdayStatus] = useState("");
  const burstIdRef = useRef(0);

  const dailyNumber = useMemo(() => getDailyNumber(), []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextTimestamp = getUnixTimestamp();
      setTimestamp(nextTimestamp);

      if (!inputTouched) {
        setInputValue(String(nextTimestamp));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [inputTouched]);

  function setIncomingCards(nextCards: FactCard[], number: string | number) {
    burstIdRef.current += 1;
    const burstCards = nextCards.map((card, index) => ({
      ...card,
      id: `${card.id}-burst-${burstIdRef.current}-${index}`,
    }));

    setCards(burstCards);
    releaseRain(String(number));
  }

  function releaseRain(number: string) {
    setParticles(createRainParticles(number, 56));
    window.setTimeout(() => setParticles([]), 5200);
  }

  async function runBurst(rawNumber = inputValue) {
    const number = sanitizeNumberInput(rawNumber) || String(timestamp);
    setInputValue(number);
    setInputTouched(true);
    setLoading(true);

    try {
      setIncomingCards(await fetchFactBurst(number), number);
    } finally {
      setLoading(false);
    }
  }

  async function handleDigitClick(digit: string) {
    await runBurst(digit);
  }

  async function handleDaily() {
    setActiveMode("daily");
    setLoading(true);

    try {
      setIncomingCards(await fetchDailyFacts(dailyNumber), dailyNumber);
    } finally {
      setLoading(false);
    }
  }

  async function handleBattle() {
    const left = sanitizeNumberInput(battleLeft) || "0";
    const right = sanitizeNumberInput(battleRight) || "0";
    setBattleLeft(left);
    setBattleRight(right);
    setLoading(true);

    try {
      const [leftFacts, rightFacts] = await Promise.all([fetchBattleFacts(left), fetchBattleFacts(right)]);
      const result = scoreBattle({ value: left, facts: leftFacts }, { value: right, facts: rightFacts });
      setBattleResult(result);
      setIncomingCards(
        [
          createFallbackFact("battle", left, "left", 0),
          createFallbackFact("battle", right, "right", 1),
        ],
        result.winner === "right" ? right : left,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleBirthday() {
    setBirthdayStatus("");

    try {
      const birthdayNumbers = extractBirthdayNumbers(birthdayDate, birthdayTime);
      setLoading(true);
      setIncomingCards(await fetchFactsForBirthday(birthdayNumbers), birthdayNumbers.map((entry) => entry.value).join(""));
      setBirthdayStatus("birth code decoded");
    } catch (error) {
      setBirthdayStatus(error instanceof Error ? error.message : "birthday could not be decoded");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="starfield" aria-hidden="true" />
      <NumberRain particles={particles} />
      <HeroNumber
        timestamp={timestamp}
        inputValue={inputValue}
        loading={loading}
        onInputChange={(value) => {
          setInputTouched(true);
          setInputValue(sanitizeNumberInput(value));
        }}
        onDigitClick={handleDigitClick}
        onQuickPick={(number) => void runBurst(String(number))}
        onSummon={() => void runBurst()}
      />
      <div className="workbench">
        <ModesPanel
          activeMode={activeMode}
          dailyNumber={dailyNumber}
          loading={loading}
          battleLeft={battleLeft}
          battleRight={battleRight}
          birthdayDate={birthdayDate}
          birthdayTime={birthdayTime}
          birthdayStatus={birthdayStatus}
          battleResult={battleResult}
          onModeChange={setActiveMode}
          onDaily={() => void handleDaily()}
          onBattleLeftChange={(value) => setBattleLeft(sanitizeNumberInput(value))}
          onBattleRightChange={(value) => setBattleRight(sanitizeNumberInput(value))}
          onRunBattle={() => void handleBattle()}
          onBirthdayDateChange={setBirthdayDate}
          onBirthdayTimeChange={setBirthdayTime}
          onDecodeBirthday={() => void handleBirthday()}
        />
        <FactDeck cards={cards} />
      </div>
      <Timeline />
      <footer className="site-footer">
        <p>Number data from curated lore, computed checks, Wikipedia date history, and Numbers API.</p>
      </footer>
      <a
        aria-label="GitHub repository"
        className="github-link"
        href="https://github.com/puneetdixit200/Number-Lore"
        rel="noreferrer"
        target="_blank"
      >
        <GitBranch aria-hidden="true" size={18} />
        GitHub
      </a>
    </main>
  );
}
