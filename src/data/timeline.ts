export interface TimelineEntry {
  number: string;
  title: string;
  era: string;
  fact: string;
}

export const timelineEntries: TimelineEntry[] = [
  {
    number: "0",
    title: "The placeholder that became a weapon",
    era: "5th century",
    fact: "Zero turned empty space into arithmetic you could build with.",
  },
  {
    number: "1",
    title: "The unit",
    era: "always",
    fact: "Every count starts by trusting one thing enough to name it.",
  },
  {
    number: "π",
    title: "The circle leak",
    era: "ancient",
    fact: "Pi keeps showing up whenever straight lines lose control.",
  },
  {
    number: "e",
    title: "Growth's quiet engine",
    era: "1683",
    fact: "Euler's number turns compounding from bookkeeping into weather.",
  },
  {
    number: "42",
    title: "The joke with a passport",
    era: "1979",
    fact: "A book joke escaped into search bars, classrooms, and commit messages.",
  },
  {
    number: "100",
    title: "The clean score",
    era: "base ten",
    fact: "Two zeros can make people feel like a system finally behaved.",
  },
  {
    number: "10^100",
    title: "Googol",
    era: "1938",
    fact: "A child named a number so large it made ordinary big talk look small.",
  },
  {
    number: "6.022e23",
    title: "Avogadro's crowd",
    era: "1811",
    fact: "Chemists needed a headcount for the invisible, so this number took the job.",
  },
  {
    number: "0:00:00",
    title: "Unix epoch",
    era: "1970",
    fact: "Modern timekeeping put a stake in the ground and started counting seconds.",
  },
];

