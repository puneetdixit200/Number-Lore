import type { CSSProperties } from "react";
import type { FactCard } from "../services/facts";

interface FactDeckProps {
  cards: FactCard[];
}

export function FactDeck({ cards }: FactDeckProps) {
  return (
    <section className="fact-zone" aria-label="fact cards">
      {cards.length === 0 ? (
        <p className="empty-deck">Pick a date. The history will make a mess here.</p>
      ) : (
        <div className="fact-deck">
          {cards.map((card) => (
            <article
              className="fact-card"
              key={card.id}
              style={
                {
                  "--burst-x": `${card.offsetX}px`,
                  "--burst-y": `${card.offsetY}px`,
                  "--burst-angle": `${card.angle}deg`,
                } as CSSProperties
              }
            >
              <div className="fact-card-top">
                <span className={`badge badge-${card.type}`}>{card.type}</span>
                <span className="source-badge">{formatSource(card.source)}</span>
              </div>
              <strong>{card.number}</strong>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatSource(source: FactCard["source"]): string {
  const labels: Record<FactCard["source"], string> = {
    computed: "computed",
    wikimedia: "wiki date",
    historylabs: "historylabs",
    dayinhistory: "day in history",
    zenquotes: "zenquotes",
    apininjas: "api ninjas",
    fallback: "fallback",
  };

  return labels[source];
}
