import type { CSSProperties } from "react";
import type { FactCard } from "../services/facts";

interface FactDeckProps {
  cards: FactCard[];
}

export function FactDeck({ cards }: FactDeckProps) {
  return (
    <section className="fact-zone" aria-label="fact cards">
      {cards.length === 0 ? (
        <p className="empty-deck">Click a digit. The facts will make a mess here.</p>
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
                {card.source !== "numbersapi" ? <span className="source-badge">{formatSource(card.source)}</span> : null}
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
    numbersapi: "numbers",
    wikipedia: "wiki",
    wikimedia: "wiki date",
    byabbe: "history",
    fallback: "fallback",
  };

  return labels[source];
}
