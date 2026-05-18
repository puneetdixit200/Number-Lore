import type { CSSProperties } from "react";
import type { RainParticle } from "../lib/numbers";

interface NumberRainProps {
  particles: RainParticle[];
}

export function NumberRain({ particles }: NumberRainProps) {
  if (particles.length === 0) {
    return null;
  }

  return (
    <div className="number-rain" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          style={
            {
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              fontSize: `${particle.size}rem`,
              "--rain-drift": `${particle.drift}rem`,
            } as CSSProperties
          }
        >
          {particle.digit}
        </span>
      ))}
    </div>
  );
}
