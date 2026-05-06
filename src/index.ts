const MS = 86_400_000;

export class Day {
  readonly date: Date; // Internal cache

  constructor(public readonly n: number) {
    this.date = new Date(n * MS);
  }

  static from(input: string | Date): Day {
    if (typeof input === 'string') {
      const [y, m, d] = input.split('-').map(Number) as [number, number, number];
      return new Day(Date.UTC(y, m - 1, d) / MS);
    }
    return new Day(Date.UTC(
      input.getFullYear(), input.getMonth(), input.getDate()
    ) / MS);
  }

  static of(n: number): Day { return new Day(n); }

  // Return Cloned Date
  toDate(): Date { return new Date(this.date); }

  // impl Print trait
  toString(): string {
    const d = this.date;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // impl Value trait
  valueOf(): number { return this.n; }

  // apply pipeline function
  $<T>(fn: (d: Day) => T): T { return fn(this); }
}

export const datex = (input: string | Date): Day => Day.from(input);

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

// ---- Components / shifts (overloaded) ----------------------------------
//
// 引数に Day を渡せばゲッター（数値）、数値を渡せば transformer を返す。
//   day('2026-08-15').$(month)       // 8
//   day('2026-08-15').$(month(+2))   // Day(2026-10-15)

export function year(d: Day): number;
export function year(n: number): (d: Day) => Day;
export function year(arg: Day | number): number | ((d: Day) => Day) {
  return typeof arg === 'number'
    ? (d: Day) => addMonthsImpl(d, arg * 12)
    : arg.date.getUTCFullYear();
}

export function month(d: Day): number;
export function month(n: number): (d: Day) => Day;
export function month(arg: Day | number): number | ((d: Day) => Day) {
  return typeof arg === 'number'
    ? (d: Day) => addMonthsImpl(d, arg)
    : arg.date.getUTCMonth() + 1;
}

export const day = (d: Day): number => d.date.getUTCDate();
export const week = (d: Day): number => d.date.getUTCDay();
export const daysInMonth = (d: Day): number =>
  endOfMonth(d).n - beginOfMonth(d).n + 1;

// ---- Day navigation ----------------------------------------------------

export const prev = (d: Day): Day => new Day(d.n - 1);
export const next = (d: Day): Day => new Day(d.n + 1);

/** n 日シフト（負で過去、正で未来）。 */
export const shift = (n: number) => (d: Day): Day => new Day(d.n + n);

export const beginOfMonth = (d: Day): Day => new Day(d.n - day(d) + 1);
export const endOfMonth = (d: Day): Day => prev(beginOfMonth(month(+1)(d)));
export const beginOfYear = (d: Day): Day => Day.from(`${year(d)}-01-01`);
export const endOfYear = (d: Day): Day => Day.from(`${year(d)}-12-31`);

// ---- Predicates --------------------------------------------------------

export const isWeekend = (d: Day): boolean => week(d) % 6 === 0;
export const isWeekday = (d: Day): boolean => !isWeekend(d);

/** 期間内（包含、'yyyy-mm-dd' 形式） */
export const inRange = (from: string, to: string) => (d: Day): boolean => {
  const x = d.toString();
  return x >= from && x <= to;
};

/** 第 n w曜日 (n=1..5, w=0..6) */
export const nthDow = (n: number, w: number) => (d: Day): boolean =>
  week(d) === w && Math.ceil(day(d) / 7) === n;

// ---- Comparisons (with reference Day) ----------------------------------

export const eq = (other: Day) => (d: Day): boolean => d.n === other.n;
export const before = (other: Day) => (d: Day): boolean => d.n < other.n;
export const after = (other: Day) => (d: Day): boolean => d.n > other.n;
export const daysTo = (other: Day) => (d: Day): number => other.n - d.n;
export const sameMonth = (other: Day) => (d: Day): boolean =>
  year(d) === year(other) && month(d) === month(other);
export const sameYear = (other: Day) => (d: Day): boolean =>
  year(d) === year(other);
