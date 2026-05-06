import { Day } from "./core";

const MS = 86_400_000;

// ---- Internal helpers --------------------------------------------------

const addMonthsImpl = (d: Day, n: number): Day => {
  const x = new Date(d.n * MS);
  const targetDom = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const lastDom = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(targetDom, lastDom));
  return new Day(x.getTime() / MS);
};

// ---- Shifts ------------------------------------------------------------

export const year =
  (n: number) =>
  (d: Day): Day =>
    addMonthsImpl(d, n * 12);
export const month =
  (n: number) =>
  (d: Day): Day =>
    addMonthsImpl(d, n);
export const day =
  (n: number) =>
  (d: Day): Day =>
    new Day(d.n + n);

export const beginOfMonth = (d: Day): Day => new Day(d.n - d.date + 1);
export const endOfMonth = (d: Day): Day => d.$(month(1)).$(beginOfMonth).$(day(-1));
export const beginOfYear = (d: Day): Day => new Day(`${d.year}-01-01`);
export const endOfYear = (d: Day): Day => new Day(`${d.year}-12-31`);

// ---- Predicates --------------------------------------------------------

export const range =
  (from: string, to: string) =>
  (d: Day): boolean => {
    const x = d.toString();
    return x >= from && x <= to;
  };

export const isSunday = (d: Day) => d.week === 0;
export const isMonday = (d: Day) => d.week === 1;
export const isTuesday = (d: Day) => d.week === 2;
export const isWednesday = (d: Day) => d.week === 3;
export const isThursday = (d: Day) => d.week === 4;
export const isFriday = (d: Day) => d.week === 5;
export const isSaturday = (d: Day) => d.week === 6;

export const isWeekend = (d: Day): boolean => d.week % 6 === 0;
export const isWeekday = (d: Day): boolean => !isWeekend(d);

export const nthWeek =
  (n: number) =>
  (d: Day): boolean =>
    Math.ceil(d.date / 7) === n;
export const nthDay =
  (n: number) =>
  (d: Day): boolean =>
    d.date === n;
export const nthMonth =
  (n: number) =>
  (d: Day): boolean =>
    d.month === n;

// ---- Comparisons (with reference Day) ----------------------------------

export const eq =
  (other: Day) =>
  (d: Day): boolean =>
    d.n === other.n;
export const before =
  (other: Day) =>
  (d: Day): boolean =>
    d.n < other.n;
export const after =
  (other: Day) =>
  (d: Day): boolean =>
    d.n > other.n;
export const daysTo =
  (other: Day) =>
  (d: Day): number =>
    other.n - d.n;
export const sameMonth =
  (other: Day) =>
  (d: Day): boolean =>
    d.year === other.year && d.month === other.month;
export const sameYear =
  (other: Day) =>
  (d: Day): boolean =>
    d.year === other.year;
