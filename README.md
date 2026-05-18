# Number Lore

Live timestamp in the center. Click a digit, type a number, or run one of the side modes. The app pulls math, trivia, and date facts from Numbers API, then throws them into animated cards with number rain.

## Run Locally

```bash
npm install
npm run dev
```

## Test

```bash
npm run test
npm run build
npm run test:e2e
```

## Vercel

Use the default Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none

The app calls `https://numbersapi.com` from the browser. If that request fails, local fallback facts keep the interface working.
