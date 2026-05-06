# datex

[English](./README.md) | **日本語**

> 日付を不変な `Day` オブジェクトとして扱い、外部の純関数を `.$` で連鎖適用して業務カレンダーを表現する小さなライブラリ。1 パッケージ + サブパス export 構成、必須依存ゼロ。

「夏は基本 A ダイヤだが土日祝は B」「月曜定休、ただし月曜が祝日なら火曜振替」のような業務ルールを、パイプライン式の関数合成で書ける。あるいは設定ファイルから JSON オブジェクトとして読み込んで実行することもできる。

`Day` クラス本体は最小（不変な日付の箱 + パイプライン応用口 `.$` のみ）。取得・シフト・述語・比較などはすべて外部の純関数として export されており、`d.$(month(+2)).$(beginOfMonth)` のように合成する。

```ts
import { datex, month, beginOfMonth, isWeekend } from 'datex';
import { isHoliday } from 'datex/locale/jp';

datex('2026-01-31').$(month(+1)).$(beginOfMonth).toString();  // '2026-02-01'
datex('2026-01-01').$(isHoliday);                             // true
datex('2026-04-18').$(isWeekend);                             // true
```

## インストール

```sh
npm install datex
# 'datex/locale/jp' を import するときだけ必要
npm install @holiday-jp/holiday_jp
```

`@holiday-jp/holiday_jp` は **optional な peerDependency**。`datex/locale/jp` を import しなければインストール不要。

## サブパス

| パス                | 説明                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `datex`             | コア: `Day` クラス + パイプライン関数群（runtime 依存ゼロ）                |
| `datex/match`       | プレーン JS オブジェクト形式の日付マッチルールエンジン（JSON / YAML から読み込んだものでも可）（runtime 依存ゼロ）|
| `datex/locale/jp`    | 日本固有の述語・ヘルパー（`@holiday-jp/holiday_jp` の peerDep）           |
| `datex/locale/<cc>`  | 各国向けサブパス。同じ形で増やしていく（`us`、`uk` など）                 |

## クイックスタート

```ts
import { datex, type Day, isWeekend, inRange, week, prev } from 'datex';
import { isHoliday } from 'datex/locale/jp';

const ferry = (d: Day): string =>
  d.$(inRange('2026-07-28', '2026-08-31')) && (
    d.$(isHoliday) && 'B' ||
    d.$(isWeekend) && 'B' ||
    'A'
  ) ||
  d.$(inRange('2025-12-29', '2026-01-03')) && 'C' ||
  // 月曜定休、月曜が祝日なら翌日に振替
  d.$(week) === 1 && !d.$(isHoliday) && 'closed' ||
  d.$(week) === 2 && d.$(prev).$(isHoliday) && 'closed' ||
  // 通常
  d.$(isWeekend) && 'B' ||
  d.$(isHoliday) && 'B' ||
  'A';

ferry(datex('2026-08-15'));  // 'B'      夏期土曜
ferry(datex('2026-08-11'));  // 'B'      夏期祝日（山の日）
ferry(datex('2025-12-31'));  // 'C'      年末年始
ferry(datex('2026-05-05'));  // 'closed' 火曜（前日が振替対象の月曜祝日）
```

各行が「`d` がこうなら → この値、そうでなければ次」の連鎖。カレンダー操作は `d.$(beginOfMonth)`、`d.$(prev)`、`d.$(shift(7))` のような関数適用で表現する。

## コンセプト

### Day クラスは最小

`Day` は内部的に「UTC で 1970-01-01 を 0 とする日通し番号」を保持する不変オブジェクト。construct 時に `Date` オブジェクトを 1 度キャッシュし、以降の getter 呼び出しは V8 内部の broken-down time キャッシュにヒットする。

```ts
class Day {
  readonly n: number;
  readonly date: Date;  // 内部キャッシュ — mutate 禁止

  static from(input: string | Date): Day;
  static of(n: number): Day;

  toString(): string;  // 'YYYY-MM-DD'
  toDate(): Date;      // 新しいクローン（mutate しても安全）
  valueOf(): number;   // === / < / > / b - a が動く

  $<T>(fn: (d: Day) => T): T;  // パイプライン応用口
}
```

操作はすべて外部関数。`d.$` で適用する。

### `.$` でパイプライン構築

`d.$(fn)` は `fn(d)` の糖衣構文。`fn` が返す値の型は `T` 任意なので、数値・boolean・別の `Day` のいずれにも展開できる。

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

### `month` / `year` は引数で getter / shift を切り替える

```ts
datex('2026-08-15').$(month);       // 8                ← getter (Day → number)
datex('2026-08-15').$(month(+2));   // Day(2026-10-15)  ← shift  (number → (Day → Day))
datex('2026-08-15').$(year);        // 2026
datex('2026-08-15').$(year(-1));    // Day(2025-08-15)
```

月末が次月に存在しない場合は次月の月末に丸める（`datex('2026-01-31').$(month(+1))` → `2026-02-28`）。

### 述語は短絡評価で組み合わせる

述語はすべて `(d: Day) => boolean` の純関数。専用の合成 API は提供せず、`&&` / `||` / `!` を直接使う。

```ts
d.$(isHoliday) && d.$(isWeekend)       // AND
d.$(isHoliday) || d.$(isWeekend)       // OR
!d.$(isHoliday)                        // NOT
d.$(prev).$(isHoliday)                 // 前日が祝日
```

### 比較は valueOf で素のJSが効く

```ts
d1 < d2           // d1 が前
d2 - d1           // 日数差（number）
d1.$(eq(d2))      // 同値判定（推奨：=== は厳密比較）
```

## API: コア (`datex`)

### コンストラクタ

| シグネチャ                         | 説明                   |
| ---------------------------------- | ---------------------- |
| `datex(s: string \| Date): Day`      | 簡易コンストラクタ     |
| `Day.from(s: string \| Date): Day` | クラスメソッド版       |
| `Day.of(n: number): Day`           | 日通し番号から直接構築 |

### 取得（`Day → number`）

`year(d)` / `month(d)` / `day(d)` / `week(d)` / `daysInMonth(d)`。`day(d)` は日 (1..31)、`week(d)` は曜日 (0..6、日曜=0)。

### シフト（`(...) → (Day → Day)`）

`prev`、`next`、`shift(n)`、`month(n)`、`year(n)`、`beginOfMonth`、`endOfMonth`、`beginOfYear`、`endOfYear`。

### 述語（`Day → boolean`）

`isWeekend`、`isWeekday`、`inRange(from, to)`、`nthDow(n, w)`。`inRange` は包含、`'YYYY-MM-DD'` 文字列。`nthDow(2, 1)` は第 2 月曜。

### 比較（参照 Day を取って predicate / number を返す）

`eq(other)`、`before(other)`、`after(other)`、`daysTo(other)`、`sameMonth(other)`、`sameYear(other)`。

## サブパス: `datex/match` — 日付マッチルールエンジン

設定駆動でルールを書ける。受け付けるのはプレーンな JS オブジェクト — TS のリテラルとして直接書いても、JSON / YAML / TOML などからパースして読み込んでも、shape さえ合えばそのまま渡せる。各キーは条件式（文字列）、値は leaf 結果かネストしたルールオブジェクト。上から評価し、最初に一致したキーが勝つ。`_` キーは default 分岐。

```ts
import { datex } from 'datex';
import { compile } from 'datex/match';
import { isHoliday } from 'datex/locale/jp';

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

### 組み込みキー

| キー | 意味 |
|---|---|
| `weekend` / `weekday` / `isWeekend` / `isWeekday` | 平日/週末 |
| `monday` … `sunday` | 曜日固定 |
| `_` | 常に真（default 分岐）|

### 関数呼び出し条件

| 形 | 意味 |
|---|---|
| `range("YYYY-MM-DD", "YYYY-MM-DD")` | 期間内（包含）|
| `nth(n, w)` | 第 n の w 曜日（例: `nth(2, 1)` = 第 2 月曜）|
| `dow(1, 2, 3)` | 曜日が `{1, 2, 3}` のいずれか |
| `dom(15)` / `month(12)` / `year(2026)` | フィールド完全一致（複数引数は OR）|

### 修飾子

- `prev.X`、`next.X`（連結可: `prev.prev.X`）— シフト先で X を評価
- `X.not` — 述語を反転

### カスタム述語

```ts
const isRainy = (d) => /* ... */;
compile(rule, { predicates: { rainy: isRainy } });
```

### JSON / YAML から読み込む

ルール形状はプレーンな JS オブジェクトなので、好きなローダで読んでそのまま渡せる:

```ts
import yaml from 'yaml';
import { compile } from 'datex/match';

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

## サブパス: `datex/locale/<country>`

国固有の述語・ヘルパーは `datex/locale/<cc>` 配下に置く。新しい国を追加してもコアや他国に影響しない設計。現状 ship されているのは:

### `datex/locale/jp`（日本）

[`@holiday-jp/holiday_jp`](https://github.com/holiday-jp/holiday_jp-js) を使った日本固有の述語 `(d: Day) => boolean`。利用時のみ peer dep を入れる:

```sh
npm install @holiday-jp/holiday_jp
```

```ts
import { datex } from 'datex';
import { isHoliday } from 'datex/locale/jp';

datex('2026-01-01').$(isHoliday);  // true (元日)
datex('2026-05-04').$(isHoliday);  // true (みどりの日)
datex('2026-05-06').$(isHoliday);  // true (振替休日)
```

### 他の国を追加するには

未提供の国は、自分で `(d: Day) => boolean` を書けば良い。コアは locale ロジックを持たないので fork は不要:

```ts
import Holidays from 'date-holidays';
import type { Day } from 'datex';

const us = new Holidays('US');
export const isHolidayUS = (d: Day): boolean => Boolean(us.isHoliday(d.toDate()));
```

`datex` 本体に同梱したい場合は `src/locale/<cc>.ts` で `(d: Day) => T` を export する形で contribute する（`datex/locale/jp` と同じ shape）。

## レシピ集

### 月末営業日

```ts
import { datex, type Day, endOfMonth, prev, isWeekend, eq } from 'datex';
import { isHoliday } from 'datex/locale/jp';

const isLastBusinessDayOfMonth = (d: Day): boolean => {
  let last = d.$(endOfMonth);
  while (last.$(isWeekend) || last.$(isHoliday)) last = last.$(prev);
  return d.$(eq(last));
};
```

### 翌月の第 1 営業日

```ts
import { datex, type Day, month, beginOfMonth, next, isWeekend } from 'datex';
import { isHoliday } from 'datex/locale/jp';

const firstBusinessDayOfNextMonth = (d: Day): Day => {
  let x = d.$(month(+1)).$(beginOfMonth);
  while (x.$(isWeekend) || x.$(isHoliday)) x = x.$(next);
  return x;
};
```

### N 営業日後

```ts
import { datex, type Day, next, isWeekend } from 'datex';
import { isHoliday } from 'datex/locale/jp';

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

## なぜ単一パッケージ + サブパス export か

- `npm install` 1 回で済む。バージョン整合の管理対象も 1 つ
- バンドラの tree-shaking が未使用サブパスを除去。`import { datex } from 'datex'` だけなら JSON DSL も祝日データもバンドルに入らない
- Node SSR / 非バンドル環境でもサブパスは別 JS ファイルなので、`datex/locale/jp` は import した時にだけロードされる
- `@holiday-jp/holiday_jp` を **optional な peerDependency** にしてあるので、祝日が要らない人は実物を持たなくて良い

## 開発

```sh
pnpm install
pnpm build
```

## ライセンス

MIT
