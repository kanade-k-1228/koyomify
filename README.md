# koyomify

**English** | [日本語](./README.ja.md)

> A small, pipeline-style calendar library built around an immutable `Day` class. Single package, subpath exports, zero required dependencies.

Lets you write business-calendar rules ("schedule A on weekdays in summer, B on weekends and holidays", "closed on Mondays — but if Monday is a holiday, close on Tuesday instead") as a chain of pipeline-style function applications, or as a JSON object loaded from a config file.

The `Day` class itself is minimal — an immutable date box plus a single pipeline application port `.$`. Lookups, shifts, predicates, and comparisons are exported as external pure functions you compose with `d.$(month(+2)).$(beginOfMonth)`.

```ts
import { datex, month, beginOfMonth, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

datex('2026-01-31').$(month(+1)).$(beginOfMonth).toString();  // '2026-02-01'
datex('2026-01-01').$(isHoliday);                             // true
datex('2026-04-18').$(isWeekend);                             // true
```

## Install

```sh
npm install koyomify
# Optional: required only if you import from 'koyomify/locale/jp'
npm install @holiday-jp/holiday_jp
```

`@holiday-jp/holiday_jp` is an optional `peerDependency`. If you never import `koyomify/locale/jp`, you don't need it.

## Subpaths

| Path               | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `koyomify`            | Core: `Day` class + pipeline functions (no runtime deps)                     |
| `koyomify/match`      | Date-match rule engine over a plain JS object (JSON / YAML loaders all work) (no runtime deps) |
| `koyomify/locale/jp`   | Japan-specific predicates and helpers (peer-deps `@holiday-jp/holiday_jp`)   |
| `koyomify/locale/<cc>` | Future country-specific subpaths follow the same shape (`us`, `uk`, ...)     |

## Quick start

```ts
import { datex, type Day, isWeekend, inRange, week, prev } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

const ferry = (d: Day): string =>
  d.$(inRange('2026-07-28', '2026-08-31')) && (
    d.$(isHoliday) && 'B' ||
    d.$(isWeekend) && 'B' ||
    'A'
  ) ||
  d.$(inRange('2025-12-29', '2026-01-03')) && 'C' ||
  // Closed on Mondays; if Monday is a holiday, close on Tuesday instead
  d.$(week) === 1 && !d.$(isHoliday) && 'closed' ||
  d.$(week) === 2 && d.$(prev).$(isHoliday) && 'closed' ||
  // Default
  d.$(isWeekend) && 'B' ||
  d.$(isHoliday) && 'B' ||
  'A';

ferry(datex('2026-08-15'));  // 'B'      summer Saturday
ferry(datex('2026-08-11'));  // 'B'      summer holiday (Mountain Day)
ferry(datex('2025-12-31'));  // 'C'      year-end
ferry(datex('2026-05-05'));  // 'closed' Tuesday after a Monday holiday
```

Each line reads as "if `d` is X, return this value, otherwise fall through to the next." Calendar operations are expressed as `d.$(beginOfMonth)`, `d.$(prev)`, `d.$(shift(7))`.

## Concepts

### `Day` is intentionally minimal

`Day` is an immutable wrapper around a "day-number" (UTC days since 1970-01-01). The internal `Date` object is cached at construction so that subsequent getter calls hit V8's broken-down time cache.

```ts
class Day {
  readonly n: number;
  readonly date: Date;  // internal cache — do not mutate

  static from(input: string | Date): Day;
  static of(n: number): Day;

  toString(): string;  // 'YYYY-MM-DD'
  toDate(): Date;      // fresh clone (safe to mutate)
  valueOf(): number;   // makes <, >, b - a work

  $<T>(fn: (d: Day) => T): T;  // pipeline application port
}
```

All operations live as external functions and are applied with `d.$`.

### `.$` builds pipelines

`d.$(fn)` is sugar for `fn(d)`. Since `T` is generic, the result can be a number, a boolean, or another `Day`.

```ts
datex('2026-08-15').$(month);             // 8         (number)
datex('2026-08-15').$(month(+2));         // Day(2026-10-15)
datex('2026-08-15').$(beginOfMonth);      // Day(2026-08-01)
datex('2026-08-15').$(isWeekend);         // false     (boolean)
datex('2026-08-15')
  .$(month(+2))
  .$(beginOfMonth)
  .$(prev)
  .toString();                          // '2026-09-30'
```

### `month` / `year` switch between getter and shift by argument

```ts
datex('2026-08-15').$(month);       // 8                ← getter (Day → number)
datex('2026-08-15').$(month(+2));   // Day(2026-10-15)  ← shift  (number → (Day → Day))
datex('2026-08-15').$(year);        // 2026
datex('2026-08-15').$(year(-1));    // Day(2025-08-15)
```

When the resulting day-of-month doesn't exist in the target month, it clamps to the last day of that month (`datex('2026-01-31').$(month(+1))` → `2026-02-28`).

### Predicates compose with short-circuit operators

Predicates are plain `(d: Day) => boolean` functions. There is no dedicated combinator API — use `&&` / `||` / `!` directly.

```ts
d.$(isHoliday) && d.$(isWeekend)       // AND
d.$(isHoliday) || d.$(isWeekend)       // OR
!d.$(isHoliday)                        // NOT
d.$(prev).$(isHoliday)                 // previous day is a holiday
```

### Comparisons fall back to plain JS via `valueOf`

```ts
d1 < d2           // d1 comes earlier
d2 - d1           // day delta (number)
d1.$(eq(d2))      // value equality (preferred — === is identity-strict)
```

## API: core (`koyomify`)

### Constructors

| Signature                          | Description                          |
| ---------------------------------- | ------------------------------------ |
| `datex(s: string \| Date): Day`      | Convenience constructor              |
| `Day.from(s: string \| Date): Day` | Static method form                   |
| `Day.of(n: number): Day`           | Build directly from a day-number     |

### Getters (`Day → number`)

`year(d)` / `month(d)` / `day(d)` / `week(d)` / `daysInMonth(d)`. `day(d)` is the day-of-month (1..31), `week(d)` is the day-of-week (0..6 with Sunday=0).

### Shifts (`(...) → (Day → Day)`)

`prev`, `next`, `shift(n)`, `month(n)`, `year(n)`, `beginOfMonth`, `endOfMonth`, `beginOfYear`, `endOfYear`.

### Predicates (`Day → boolean`)

`isWeekend`, `isWeekday`, `inRange(from, to)`, `nthDow(n, w)`. `inRange` takes inclusive `'YYYY-MM-DD'` strings. `nthDow(2, 1)` is the 2nd Monday.

### Comparisons (take a reference Day, return predicate or number)

`eq(other)`, `before(other)`, `after(other)`, `daysTo(other)`, `sameMonth(other)`, `sameYear(other)`.

## Subpath: `koyomify/match` — date-match rule engine

For configuration-driven rules. Accepts a plain JS object — write it as a TS literal, or load it from JSON / YAML / TOML; whatever shape ends up in memory is the input. Each key is a condition expression (string), each value is either a leaf result or a nested rule object. Rules are evaluated top-down; the first matching key wins. Use the special key `_` for the default branch.

```ts
import { datex } from 'koyomify';
import { compile } from 'koyomify/match';
import { isHoliday } from 'koyomify/locale/jp';

const ferry = compile({
  'range("2026-07-28", "2026-08-31")': {
    holiday: 'B',
    weekend: 'B',
    _: 'A',
  },
  'range("2025-12-29", "2026-01-03")': 'C',
  monday:  { 'isHoliday.not': 'closed' },
  tuesday: { 'prev.isHoliday': 'closed' },
  weekend: 'B',
  holiday: 'B',
  _: 'A',
}, { predicates: { holiday: isHoliday, isHoliday } });

ferry(datex('2026-08-15'));  // 'B'
ferry(datex('2026-05-05'));  // 'closed'
```

### Built-in condition keys

| Key | Meaning |
|---|---|
| `weekend` / `weekday` / `isWeekend` / `isWeekday` | weekday-based |
| `monday` … `sunday` | exact day-of-week |
| `_` | always-match (default branch) |

### Function-call conditions

| Form | Meaning |
|---|---|
| `range("YYYY-MM-DD", "YYYY-MM-DD")` | inclusive date range |
| `nth(n, w)` | n-th day-of-week w (e.g. `nth(2, 1)` = 2nd Monday) |
| `dow(1, 2, 3)` | day-of-week is in `{1, 2, 3}` |
| `dom(15)`, `month(12)`, `year(2026)` | exact field match (multi-arg = OR) |

### Modifiers

- `prev.X`, `next.X` (chainable: `prev.prev.X`) — apply X to a shifted day
- `X.not` — negate the predicate

### Custom predicates

```ts
const isRainy = (d) => /* ... */;
compile(rule, { predicates: { rainy: isRainy } });
```

### Loading from JSON / YAML

Because the rule shape is a plain JS object, any loader works:

```ts
import yaml from 'yaml';
import { compile } from 'koyomify/match';

const rule = yaml.parse(await fs.readFile('schedule.yml', 'utf8'));
const ferry = compile(rule, { predicates: { isHoliday } });
```

```yaml
# schedule.yml
'range("2026-07-28", "2026-08-31")':
  isHoliday: B
  isWeekend: B
  _:         A
weekend: B
_:       A
```

## Subpath: `koyomify/locale/<country>`

Country-specific predicates and helpers live under `koyomify/locale/<cc>` so that adding a new locale doesn't pollute the core or other locales. Currently shipped:

### `koyomify/locale/jp` (Japan)

`(d: Day) => boolean` predicates backed by [`@holiday-jp/holiday_jp`](https://github.com/holiday-jp/holiday_jp-js). Install the peer dep when you need it:

```sh
npm install @holiday-jp/holiday_jp
```

```ts
import { datex } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

datex('2026-01-01').$(isHoliday);  // true   (New Year's Day)
datex('2026-05-04').$(isHoliday);  // true   (Greenery Day)
datex('2026-05-06').$(isHoliday);  // true   (substitute holiday)
```

### Adding another country

For locales not yet shipped, just write your own `(d: Day) => boolean` — the core has no locale logic, so no fork is needed:

```ts
import Holidays from 'date-holidays';
import type { Day } from 'koyomify';

const us = new Holidays('US');
export const isHolidayUS = (d: Day): boolean => Boolean(us.isHoliday(d.toDate()));
```

If you want it to ship with `koyomify` itself, contribute it as `src/locale/<cc>.ts` exposing `(d: Day) => T` functions — the same shape as `koyomify/locale/jp`.

## Recipes

### Last business day of the month

```ts
import { datex, type Day, endOfMonth, prev, isWeekend, eq } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

const isLastBusinessDayOfMonth = (d: Day): boolean => {
  let last = d.$(endOfMonth);
  while (last.$(isWeekend) || last.$(isHoliday)) last = last.$(prev);
  return d.$(eq(last));
};
```

### First business day of next month

```ts
import { datex, type Day, month, beginOfMonth, next, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

const firstBusinessDayOfNextMonth = (d: Day): Day => {
  let x = d.$(month(+1)).$(beginOfMonth);
  while (x.$(isWeekend) || x.$(isHoliday)) x = x.$(next);
  return x;
};
```

### Add N business days

```ts
import { datex, type Day, next, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp';

const addBusinessDays = (d: Day, n: number): Day => {
  let cursor = d;
  let remaining = n;
  while (remaining > 0) {
    cursor = cursor.$(next);
    if (!cursor.$(isWeekend) && !cursor.$(isHoliday)) remaining--;
  }
  return cursor;
};
```

## Why a single package with subpaths?

- One `npm install` instead of three. One version to coordinate.
- Bundlers tree-shake unused subpaths. If you only `import { datex } from 'koyomify'`, neither the JSON DSL nor the holiday data ever land in your bundle.
- For Node SSR / non-bundled environments, subpaths are separate JS files — `koyomify/locale/jp` is loaded only when imported.
- `@holiday-jp/holiday_jp` is an *optional* peer dependency, so users who don't need Japanese holidays carry no runtime data.

## Development

```sh
pnpm install
pnpm build
```

## License

MIT
