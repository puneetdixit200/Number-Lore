# Number Lore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a polished, animation-heavy Number Lore React app with tested number helpers, Numbers API fallback behavior, playful modes, and Vercel-ready static output.

**Architecture:** Use a Vite React SPA with pure number/domain helpers in `src/lib`, API/fallback orchestration in `src/services`, and focused components in `src/components`. Keep visible copy terse and concrete so the product feels authored, not generated.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Playwright, Lucide React, CSS animations.

---

## File Structure

- Create `package.json`: scripts, dependencies, dev dependencies, metadata.
- Create `index.html`: Vite mount point and font preconnects.
- Create `vite.config.ts`: React plugin, Vitest jsdom config.
- Create `tsconfig.json`, `tsconfig.node.json`: TypeScript settings.
- Create `.gitignore`: Node, Vite, Playwright, Vercel, and local scratch ignores.
- Create `src/main.tsx`: React root bootstrap.
- Create `src/App.tsx`: app shell, state orchestration, event handlers.
- Create `src/App.test.tsx`: component tests for hero, fact loading, fallback, birthday validation, battle mode.
- Create `src/components/HeroNumber.tsx`: timestamp digits and number entry.
- Create `src/components/FactDeck.tsx`: animated fact card deck.
- Create `src/components/NumberRain.tsx`: falling digit overlay.
- Create `src/components/ModesPanel.tsx`: daily, battle, birthday controls.
- Create `src/components/Timeline.tsx`: vertical curated number history.
- Create `src/lib/numbers.ts`: pure helpers.
- Create `src/lib/numbers.test.ts`: helper tests.
- Create `src/services/facts.ts`: Numbers API URL construction, fetch, fallback cards.
- Create `src/services/facts.test.ts`: service tests with mocked fetch.
- Create `src/data/timeline.ts`: curated timeline entries.
- Create `src/styles.css`: complete visual system and responsive layout.
- Create `playwright.config.ts`: local server web test config.
- Create `tests/number-lore.spec.ts`: browser smoke tests.
- Create `README.md`: local usage, Vercel settings, feature summary.

---

### Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Add package and tooling files**

Create a Vite React TypeScript project shell with these scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` is created and install exits 0.

- [ ] **Step 3: Commit scaffold**

Run:

```bash
git add .gitignore package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json
git commit -m "chore: scaffold Vite app"
```

---

### Task 2: Number Helper TDD

**Files:**
- Create: `src/lib/numbers.test.ts`
- Create: `src/lib/numbers.ts`

- [ ] **Step 1: Write failing helper tests**

Tests must cover:

```ts
expect(getUnixTimestamp(new Date("1970-01-01T00:00:42.000Z"))).toBe(42);
expect(splitDigits("1700000000")).toEqual(["1", "7", "0", "0", "0", "0", "0", "0", "0", "0"]);
expect(sanitizeNumberInput("  12345678901234567890abc ")).toBe("123456789012");
expect(getDailyNumber(new Date("2026-05-18T00:00:00"))).toBe(getDailyNumber(new Date("2026-05-18T23:59:59")));
expect(extractBirthdayNumbers("1990-07-14", "09:35")).toEqual(expect.arrayContaining([
  expect.objectContaining({ label: "month", value: 7 }),
  expect.objectContaining({ label: "day", value: 14 }),
  expect.objectContaining({ label: "year", value: 1990 }),
  expect.objectContaining({ label: "hour", value: 9 }),
  expect.objectContaining({ label: "minute", value: 35 })
]));
```

- [ ] **Step 2: Run helper tests and verify RED**

Run: `npm run test -- src/lib/numbers.test.ts`
Expected: FAIL because `src/lib/numbers.ts` does not exist or exports are missing.

- [ ] **Step 3: Implement helpers**

Implement:

```ts
export function getUnixTimestamp(date = new Date()): number;
export function splitDigits(value: string | number): string[];
export function sanitizeNumberInput(value: string): string;
export function getDailyNumber(date = new Date()): number;
export function extractBirthdayNumbers(dateValue: string, timeValue?: string): BirthdayNumber[];
export function scoreBattle(left: BattleInput, right: BattleInput): BattleResult;
export function createRainParticles(source: string, count?: number): RainParticle[];
```

- [ ] **Step 4: Run helper tests and verify GREEN**

Run: `npm run test -- src/lib/numbers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit helper layer**

Run:

```bash
git add src/lib/numbers.ts src/lib/numbers.test.ts
git commit -m "feat: add number domain helpers"
```

---

### Task 3: Facts Service TDD

**Files:**
- Create: `src/services/facts.test.ts`
- Create: `src/services/facts.ts`

- [ ] **Step 1: Write failing facts tests**

Tests must cover:

```ts
expect(buildNumbersApiUrl({ kind: "math", number: 42 })).toBe("https://numbersapi.com/42/math");
expect(buildNumbersApiUrl({ kind: "trivia", number: 42 })).toBe("https://numbersapi.com/42/trivia");
expect(buildNumbersApiUrl({ kind: "date", month: 5, day: 18 })).toBe("https://numbersapi.com/5/18/date");
```

Also mock `fetch` to return text for success and throw for fallback:

```ts
await expect(fetchFactBurst(7, new Date("2026-05-18T00:00:00"))).resolves.toHaveLength(3);
expect(cards.some((card) => card.source === "fallback")).toBe(true);
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `npm run test -- src/services/facts.test.ts`
Expected: FAIL because service exports do not exist.

- [ ] **Step 3: Implement facts service**

Implement typed fact cards:

```ts
export type FactType = "math" | "trivia" | "date" | "daily" | "birthday" | "battle";
export type FactSource = "numbersapi" | "fallback";
export interface FactCard {
  id: string;
  type: FactType;
  number: string;
  text: string;
  source: FactSource;
  angle: number;
  offsetX: number;
  offsetY: number;
}
```

Fetch text from Numbers API, trim empty responses, and return fallback cards for failed calls.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm run test -- src/services/facts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit service layer**

Run:

```bash
git add src/services/facts.ts src/services/facts.test.ts
git commit -m "feat: add Numbers API facts service"
```

---

### Task 4: App Component TDD

**Files:**
- Create: `src/App.test.tsx`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/components/HeroNumber.tsx`
- Create: `src/components/FactDeck.tsx`
- Create: `src/components/NumberRain.tsx`
- Create: `src/components/ModesPanel.tsx`
- Create: `src/components/Timeline.tsx`
- Create: `src/data/timeline.ts`

- [ ] **Step 1: Write failing component tests**

Tests must assert:

```ts
render(<App />);
expect(screen.getByLabelText(/live unix timestamp/i)).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /summon facts/i }));
expect(await screen.findByText(/math/i)).toBeInTheDocument();
```

Also test birthday validation and battle result rendering:

```ts
await user.click(screen.getByRole("button", { name: /birth code/i }));
await user.click(screen.getByRole("button", { name: /decode birthday/i }));
expect(screen.getByText(/choose a date first/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL because app components do not exist.

- [ ] **Step 3: Implement minimal components**

Implement the app with:

- Live timestamp state updated by `setInterval`.
- Clickable digit spans.
- Main number input and fact trigger.
- Daily, battle, birthday controls.
- Fact deck and rain overlay.
- Timeline component with curated entries.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit UI structure**

Run:

```bash
git add src/main.tsx src/App.tsx src/App.test.tsx src/components src/data
git commit -m "feat: build Number Lore interactions"
```

---

### Task 5: Visual System And Copy Pass

**Files:**
- Create: `src/styles.css`
- Modify: `src/App.tsx`
- Modify: `src/components/*.tsx`
- Modify: `README.md`

- [ ] **Step 1: Add visual system**

Use a dark, high-contrast palette with restrained accent variety: ink, electric cyan, acid green, amber, pink-red, and violet accents. Avoid generic purple gradient dominance, decorative orb backgrounds, stock-card landing page patterns, and filler feature copy.

- [ ] **Step 2: Apply stop-slop copy check**

Visible text should be direct:

```text
Summon facts
Daily number
Number battle
Birth code
Type a number. Hit the burst.
Choose a date first.
```

Avoid copy like:

```text
Unlock fascinating insights
Embark on a journey
Discover the magic of numbers
Designed to delight
```

- [ ] **Step 3: Run component tests**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit visual layer**

Run:

```bash
git add src/styles.css src/App.tsx src/components README.md
git commit -m "feat: add kinetic visual design"
```

---

### Task 6: Browser Smoke Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/number-lore.spec.ts`

- [ ] **Step 1: Write failing Playwright smoke test**

Test must:

```ts
await page.goto("/");
await expect(page.getByLabel(/live unix timestamp/i)).toBeVisible();
await page.getByRole("button", { name: /summon facts/i }).click();
await expect(page.getByText(/math/i)).toBeVisible();
await page.setViewportSize({ width: 390, height: 844 });
await expect(page.getByRole("button", { name: /daily number/i })).toBeVisible();
```

- [ ] **Step 2: Run e2e test and verify result**

Run: `npm run test:e2e`
Expected: PASS after app is implemented. If Chromium is missing, install Playwright browsers and rerun.

- [ ] **Step 3: Commit browser tests**

Run:

```bash
git add playwright.config.ts tests/number-lore.spec.ts
git commit -m "test: add browser smoke coverage"
```

---

### Task 7: Final Verification And Deployment

**Files:**
- Modify: `README.md` if verification finds setup gaps.

- [ ] **Step 1: Run unit and component tests**

Run: `npm run test`
Expected: all Vitest suites pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: TypeScript build and Vite build exit 0 and create `dist`.

- [ ] **Step 3: Run browser smoke tests**

Run: `npm run test:e2e`
Expected: Playwright test exits 0.

- [ ] **Step 4: Run local browser verification**

Start dev server and inspect the page at desktop and mobile widths. Verify timestamp is visible, no major overlap occurs, fact burst appears, mode buttons remain usable, and timeline scrolls.

- [ ] **Step 5: Commit any final fixes**

Run:

```bash
git status --short
git add <changed-files>
git commit -m "fix: polish Number Lore verification issues"
```

- [ ] **Step 6: Push to GitHub**

Run: `git push origin main`
Expected: push succeeds to `https://github.com/puneetdixit200/Number-Lore.git`.

- [ ] **Step 7: Deploy to Vercel**

Run: `npx vercel@latest deploy --prod --yes`
Expected: deployment reaches READY and returns a production URL. If authentication is missing, report the exact CLI message and leave the repo pushed and Vercel-ready.

---

## Self-Review

- Spec coverage: The plan covers the live timestamp hero, fact explosion, number rain, daily number, number battle, birthday mode, timeline, fallback behavior, accessibility labels, testing, GitHub push, and Vercel deployment.
- Placeholder scan: The plan contains no unresolved markers and names concrete files, commands, and assertions.
- Type consistency: Helper, service, and component names match across tasks.
