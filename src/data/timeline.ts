export interface TimelineEntry {
  date: string;
  title: string;
  era: string;
  fact: string;
}

export const timelineEntries: TimelineEntry[] = [
  {
    date: "01/01",
    title: "The calendar reload",
    era: "annual",
    fact: "New Year's Day is a cultural reset button: promises, ledgers, budgets, and public rituals all restart at once.",
  },
  {
    date: "03/14",
    title: "Circles get a holiday",
    era: "Pi Day",
    fact: "March 14 turned a notation joke into an annual excuse for math departments to act less serious.",
  },
  {
    date: "04/12",
    title: "Humans leave Earth",
    era: "1961",
    fact: "Yuri Gagarin's orbit made spaceflight stop being theory and become a timestamp.",
  },
  {
    date: "05/18",
    title: "The mountain opens",
    era: "1980",
    fact: "Mount St. Helens erupted with enough force to flatten forest and redraw the shape of the volcano.",
  },
  {
    date: "07/20",
    title: "The Moon gets footprints",
    era: "1969",
    fact: "Apollo 11 landed on the Moon and made one date do the work of a whole century of engineering ambition.",
  },
  {
    date: "08/06",
    title: "The atomic age arrives",
    era: "1945",
    fact: "Hiroshima made a scientific breakthrough inseparable from civilian catastrophe and geopolitical dread.",
  },
  {
    date: "09/11",
    title: "A date becomes shorthand",
    era: "2001",
    fact: "Some dates stop being calendar coordinates and become a name people say without adding the year.",
  },
  {
    date: "10/04",
    title: "The first artificial moon",
    era: "1957",
    fact: "Sputnik's beep made the Cold War audible and pushed science education into emergency mode.",
  },
  {
    date: "12/25",
    title: "A ritual collision",
    era: "annual",
    fact: "Christmas carries religion, commerce, folklore, family logistics, and a global supply chain on the same date.",
  },
];
