import { timelineEntries } from "../data/timeline";

export function Timeline() {
  return (
    <section className="timeline-section" aria-labelledby="timeline-title">
      <div className="section-heading">
        <span>number history</span>
        <h2 id="timeline-title">A vertical argument with the past</h2>
      </div>
      <div className="timeline">
        {timelineEntries.map((entry) => (
          <article className="timeline-entry" key={`${entry.number}-${entry.title}`}>
            <div className="timeline-number">{entry.number}</div>
            <div className="timeline-copy">
              <span>{entry.era}</span>
              <h3>{entry.title}</h3>
              <p>{entry.fact}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

