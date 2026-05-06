export const newday = (input: number | string | Date) => new Day(input);

export type Operator<T> = (d: Day) => T;

const MS = 86_400_000;

export class Day {
  readonly n: number;
  readonly #date: Date; // Internal cache

  constructor(input: number | string | Date) {
    if (typeof input === "number") {
      this.n = input;
    } else if (typeof input === "string") {
      const [y, m, d] = input.split("-").map(Number) as [number, number, number];
      this.n = Date.UTC(y, m - 1, d) / MS;
    } else {
      this.n = Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()) / MS;
    }
    this.#date = new Date(this.n * MS);
  }

  // Component getters
  get year(): number {
    return this.#date.getUTCFullYear();
  }
  get month(): number {
    return this.#date.getUTCMonth() + 1;
  } // 1..12
  get date(): number {
    return this.#date.getUTCDate();
  } // 1..31
  get week(): number {
    return this.#date.getUTCDay();
  } // 0..6 (Sunday=0)

  // Return Cloned Date
  toDate(): Date {
    return new Date(this.#date);
  }

  // impl Print trait
  toString(): string {
    return `${this.year}-${String(this.month).padStart(2, "0")}-${String(this.date).padStart(2, "0")}`;
  }

  // impl Value trait
  valueOf(): number {
    return this.n;
  }

  // apply pipeline function
  $<T>(fn: Operator<T>): T {
    return fn(this);
  }
}
