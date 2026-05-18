# Number Lore Design

Date: 2026-05-18

## Goal

Build Number Lore as a kinetic, weird, addictive single-page web app. The first screen centers a giant live Unix timestamp where each digit is independently animated and clickable. Interacting with numbers should trigger a visible explosion of facts, number rain, and playful modes that make the page feel alive rather than informational.

## Stack

Use a React + Vite + TypeScript single-page app. The app has no backend requirement and can call Numbers API directly from the browser. Vercel can host the static build output from `npm run build`.

Primary dependencies:

- React for UI state and composition.
- Vite for local development and production build.
- Vitest and Testing Library for unit and component tests.
- Playwright for browser smoke testing.
- Lucide React for interface icons where controls need icons.

## Experience

The landing viewport is the product. It shows the current Unix timestamp in a 20vw-style Space Grotesk display treatment, with each digit rendered as its own interactive element. Digits pulse in a staggered opacity wave, react to hover, and can be clicked independently.

Core interactions:

- Clicking any digit or submitted number fetches math, trivia, and date facts.
- Fact cards fly in from varied directions with spring-like overshoot easing.
- Fact cards use glass panel styling and colored badges for math, trivia, date, daily, birthday, and battle facts.
- After a fact burst, number rain falls through the screen using the active number's digits.
- A command strip lets users type a number, trigger facts, open Daily Number, run Number Battle, and enter Birthday Mode.
- Scrolling reveals a connected vertical timeline of important numbers in history.

The visual direction should be high-contrast, dark, hypnotic, and information-dense without becoming a generic landing page. The first viewport must be the working app, not marketing copy.

## Features

### Live Timestamp Hero

- Display the current Unix timestamp, updating every second.
- Split every digit into a separate clickable span.
- Add idle wave pulsing and hover transforms.
- Clicking a digit uses that digit as the selected number; pressing the main action uses the typed or current number.

### Fact Explosion

- Fetch facts from:
  - `https://numbersapi.com/{n}/math`
  - `https://numbersapi.com/{n}/trivia`
  - `https://numbersapi.com/{month}/{day}/date`
- Normalize all responses into a shared fact card model.
- Animate new cards from random directions and positions.
- Keep a bounded deck of recent cards so the UI stays performant.
- If a request fails, use curated local fallback facts and mark them as fallback content.

### Number Rain

- After each burst, create a short-lived overlay of falling digit particles.
- Use the active number's digits as the particle alphabet.
- Keep particles non-interactive so they never block controls.

### Daily Number

- Derive a stable daily number from the local date.
- Show a mini deep-dive with fetched facts and a deterministic local insight.
- The same date should produce the same daily number.

### Number Battle

- Accept two numbers.
- Fetch or synthesize facts for both.
- Score each side based on fact variety, length, uniqueness, and deterministic quirks.
- Show winner, score bars, and best fact snippets.

### Birthday Mode

- Accept a date and optional time.
- Extract meaningful numbers: month, day, year, hour, minute, date sum, and digit sum.
- Fetch or synthesize cards for those numbers.
- Present the results as a personal burst without requiring accounts or persistence.

### Timeline

- Build a vertical timeline with fixed curated entries such as 0, 1, pi, e, 42, 100, googol, Avogadro's number, and Unix epoch.
- Each entry includes a short title, date or era where relevant, and a fact.
- Use connected line styling and scroll reveal effects.

## Data Flow

UI events call small service functions rather than fetching inline inside components. The facts service builds Numbers API URLs, fetches text, converts it into typed fact cards, and returns fallback content on error. App state owns selected number, cards, rain particles, mode state, and battle/birthday results.

Keep deterministic helpers pure and tested:

- `getUnixTimestamp`
- `splitDigits`
- `buildNumbersApiUrl`
- `getDailyNumber`
- `extractBirthdayNumbers`
- `scoreBattle`
- `createFallbackFact`

## Error Handling

Network errors, non-OK responses, malformed values, and empty API text should not break the app. The UI should still animate and show local fallback cards. User input should be trimmed, numeric input should be bounded to a reasonable display length, and invalid birthday or battle entries should show inline status text rather than alerts.

## Accessibility

Interactive digits and icon buttons must have accessible labels. Motion-heavy sections should respect `prefers-reduced-motion` by reducing transform intensity and disabling continuous rain. Text contrast must remain readable on glass panels.

## Testing

Automated tests:

- Pure helper unit tests for timestamp formatting, digit splitting, API URL construction, daily number determinism, birthday extraction, battle scoring, and fallback facts.
- Component tests for rendering the timestamp digits, triggering fact loads, showing fallback content, birthday mode validation, and battle results.
- Production build verification with `npm run build`.
- Browser smoke test on the local dev server to verify the page loads, the timestamp appears, a fact burst can be triggered, and no obvious layout overlap appears at desktop and mobile widths.

## Deployment

The project should be Vercel-ready with standard scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`

The Vercel deployment can use the Vite defaults: build command `npm run build`, output directory `dist`. No secrets are required.
