import { Day } from "../../core.js";

const ERAS: { name: string; start: number; startYear: number }[] = [
  { name: "令和", start: new Day("2019-05-01").n, startYear: 2019 },
  { name: "平成", start: new Day("1989-01-08").n, startYear: 1989 },
  { name: "昭和", start: new Day("1926-12-25").n, startYear: 1926 },
  { name: "大正", start: new Day("1912-07-30").n, startYear: 1912 },
  { name: "明治", start: new Day("1868-10-23").n, startYear: 1868 },
];

export const era = (d: Day): [string, number] => {
  for (const e of ERAS) {
    if (d.n >= e.start) return [e.name, d.year - e.startYear + 1];
  }
  throw new Error(`era: unsupported date ${d.toString()}`);
};
