# koyomify

[English](./README.md) | **日本語**

> 日付を不変な `Day` オブジェクトとして扱い、外部の純関数を `.$` で連鎖適用して業務カレンダーを表現する小さなライブラリ。1 パッケージ + サブパス export 構成、必須依存ゼロ。

「夏は基本 A ダイヤだが土日祝は B」「月曜定休、ただし月曜が祝日なら火曜振替」のような業務ルールを、パイプライン式の関数合成で書ける。あるいは設定ファイルから JSON オブジェクトとして読み込んで実行することもできる。

`Day` クラス本体は最小（不変な日付の箱 + パイプライン応用口 `.$` のみ）。取得・シフト・述語・比較などはすべて外部の純関数として export されており、`d.$(month(+2)).$(beginOfMonth)` のように合成する。

```ts
import { Day, month, beginOfMonth, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp/holiday';

new Day('2026-01-31').$(month(+1)).$(beginOfMonth).toString();  // '2026-02-01'
new Day('2026-01-01').$(isHoliday);                             // true
new Day('2026-04-18').$(isWeekend);                             // true
```

## インストール

```sh
npm install koyomify
# 'koyomify/locale/jp/holiday' を import するときだけ必要
npm install @holiday-jp/holiday_jp
```

`@holiday-jp/holiday_jp` は **optional な peerDependency**。`koyomify/locale/jp/holiday` を import しなければインストール不要。

## サブパス

| パス                | 説明                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `koyomify`                   | コア: `Day` クラス + パイプライン関数群（runtime 依存ゼロ）                |
| `koyomify/match`             | プレーン JS オブジェクト形式の日付マッチルールエンジン（JSON / YAML から読み込んだものでも可）（runtime 依存ゼロ）|
| `koyomify/locale/jp/era`     | 和暦ヘルパ (`era`) — runtime 依存なし                                      |
| `koyomify/locale/jp/week`    | 曜日名の配列 (`WeekdayName`, `WeekdayNameShort`) — runtime 依存なし        |
| `koyomify/locale/jp/holiday` | `isHoliday`（`@holiday-jp/holiday_jp` の peerDep）                         |
| `koyomify/locale/<cc>/...`   | 各国向けサブパス。同じ形で増やしていく（`us`、`uk` など）                  |

## クイックスタート

```ts
import { Day, isWeekend, inRange, prev } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp/holiday';

const ferry = (d: Day): string =>
  d.$(inRange('2026-07-28', '2026-08-31')) && (
    d.$(isHoliday) && 'B' ||
    d.$(isWeekend) && 'B' ||
    'A'
  ) ||
  d.$(inRange('2025-12-29', '2026-01-03')) && 'C' ||
  // 月曜定休、月曜が祝日なら翌日に振替
  d.week === 1 && !d.$(isHoliday) && 'closed' ||
  d.week === 2 && d.$(prev).$(isHoliday) && 'closed' ||
  // 通常
  d.$(isWeekend) && 'B' ||
  d.$(isHoliday) && 'B' ||
  'A';

ferry(new Day('2026-08-15'));  // 'B'      夏期土曜
ferry(new Day('2026-08-11'));  // 'B'      夏期祝日（山の日）
ferry(new Day('2025-12-31'));  // 'C'      年末年始
ferry(new Day('2026-05-05'));  // 'closed' 火曜（前日が振替対象の月曜祝日）
```

各行が「`d` がこうなら → この値、そうでなければ次」の連鎖。カレンダー操作は `d.$(beginOfMonth)`、`d.$(prev)`、`d.$(shift(7))` のような関数適用で表現する。

## コンセプト

### Day クラスは最小

`Day` は内部的に「UTC で 1970-01-01 を 0 とする日通し番号」を保持する不変オブジェクト。construct 時に `Date` オブジェクトを 1 度キャッシュし、以降の getter 呼び出しは V8 内部の broken-down time キャッシュにヒットする。

```ts
class Day {
  readonly n: number;

  constructor(input: number | string | Date);

  get year(): number;   // 西暦
  get month(): number;  // 1..12
  get date(): number;   // 1..31（日）
  get week(): number;   // 0..6（曜日、日曜=0）

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
new Day('2026-08-15').month;                // 8         (number, getter)
new Day('2026-08-15').$(month(+2));         // Day(2026-10-15)
new Day('2026-08-15').$(beginOfMonth);      // Day(2026-08-01)
new Day('2026-08-15').$(isWeekend);         // false     (boolean)
new Day('2026-08-15')
  .$(month(+2))
  .$(beginOfMonth)
  .$(prev)
  .toString();                          // '2026-09-30'
```

### 取得はインスタンス getter、シフトは `month(n)` / `year(n)`

```ts
new Day('2026-08-15').month;          // 8                ← インスタンス getter
new Day('2026-08-15').year;           // 2026             ← インスタンス getter
new Day('2026-08-15').$(month(+2));   // Day(2026-10-15)  ← shift  (number → (Day → Day))
new Day('2026-08-15').$(year(-1));    // Day(2025-08-15)
```

月末が次月に存在しない場合は次月の月末に丸める（`new Day('2026-01-31').$(month(+1))` → `2026-02-28`）。

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

## API: コア (`koyomify`)

### コンストラクタ

| シグネチャ                                         | 説明                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `new Day(input: number \| string \| Date): Day`    | 日通し番号 / `'YYYY-MM-DD'` 文字列 / `Date` のいずれからでも構築  |

### 取得（インスタンス getter）

`d.year` / `d.month` / `d.date` / `d.week`。`d.date` は日 (1..31)、`d.week` は曜日 (0..6、日曜=0)。月の日数は `daysInMonth(d)`。

### シフト（`(...) → (Day → Day)`）

`prev`、`next`、`shift(n)`、`month(n)`、`year(n)`、`beginOfMonth`、`endOfMonth`、`beginOfYear`、`endOfYear`。

### 述語（`Day → boolean`）

`isWeekend`、`isWeekday`、`inRange(from, to)`、`nthDow(n, w)`。`inRange` は包含、`'YYYY-MM-DD'` 文字列。`nthDow(2, 1)` は第 2 月曜。

### 比較（参照 Day を取って predicate / number を返す）

`eq(other)`、`before(other)`、`after(other)`、`daysTo(other)`、`sameMonth(other)`、`sameYear(other)`。

## サブパス: `koyomify/match` — 日付マッチルールエンジン

設定駆動でルールを書ける。受け付けるのはプレーンな JS オブジェクト — TS のリテラルとして直接書いても、JSON / YAML / TOML などからパースして読み込んでも、shape さえ合えばそのまま渡せる。各キーは条件式（文字列）、値は leaf 結果かネストしたルールオブジェクト。上から評価し、最初に一致したキーが勝つ。`*` キーは default 分岐。

```ts
import { Day } from 'koyomify';
import { match } from 'koyomify/match';
import { isHoliday } from 'koyomify/locale/jp/holiday';

const ferry = match({
  '2026-07-28..2026-08-31': {
    holiday: 'B',
    weekend: 'B',
    '*': 'A',
  },
  '2025-12-29..2026-01-03': 'C',
  monday:  { 'isHoliday.not': 'closed' },
  tuesday: { 'prev.isHoliday': 'closed' },
  weekend: 'B',
  holiday: 'B',
  '*': 'A',
}, { predicates: { holiday: isHoliday, isHoliday } });

ferry(new Day('2026-08-15'));  // 'B'
ferry(new Day('2026-05-05'));  // 'closed'
```

### 組み込みキー

| キー | 意味 |
|---|---|
| `weekend` / `weekday` / `isWeekend` / `isWeekday` | 平日/週末 |
| `monday` … `sunday` | 曜日固定 |
| `*` | 常に真（default 分岐）|

### 日付条件

| 形 | 意味 |
|---|---|
| `YYYY-MM-DD` | 単一日（例: `'2026-08-15'`）|
| `YYYY-MM-DD..YYYY-MM-DD` | 期間内（包含）。例: `'2026-07-28..2026-08-31'` |

### 関数呼び出し条件

| 形 | 意味 |
|---|---|
| `nth(n, w)` | 第 n の w 曜日（例: `nth(2, 1)` = 第 2 月曜）|
| `nthweek(n)` | 月内 n 週目（曜日キーとネストして使う。例: `nthweek(1) > friday`）|
| `dow(1, 2, 3)` | 曜日が `{1, 2, 3}` のいずれか |
| `dom(15)` / `month(12)` / `year(2026)` | フィールド完全一致（複数引数は OR）|

### 修飾子

- `prev.X`、`next.X`（連結可: `prev.prev.X`）— シフト先で X を評価
- `X.not` — 述語を反転

### カスタム述語

```ts
const isRainy = (d) => /* ... */;
match(rule, { predicates: { rainy: isRainy } });
```

### JSON / YAML から読み込む

ルール形状はプレーンな JS オブジェクトなので、好きなローダで読んでそのまま渡せる:

```ts
import yaml from 'yaml';
import { match } from 'koyomify/match';

const rule = yaml.parse(await fs.readFile('schedule.yml', 'utf8'));
const ferry = match(rule, { predicates: { isHoliday } });
```

```yaml
# schedule.yml
'2026-07-28..2026-08-31':
  isHoliday: B
  isWeekend: B
  '*':       A
weekend: B
'*':     A
```

## サブパス: `koyomify/locale/<country>`

国固有の述語・ヘルパーは `koyomify/locale/<cc>` 配下に置く。新しい国を追加してもコアや他国に影響しない設計。現状 ship されているのは:

### `koyomify/locale/jp/*`（日本）

機能ごとにサブパスを分けてあるので、必要なものだけロードできる:

| サブパス | export | runtime 依存 |
|---|---|---|
| `koyomify/locale/jp/era`     | `era(d)` — 和暦の元号 + 年   | なし |
| `koyomify/locale/jp/week`    | `WeekdayName` / `WeekdayNameShort` — 曜日名の配列 | なし |
| `koyomify/locale/jp/holiday` | `isHoliday(d)`               | `@holiday-jp/holiday_jp`（peer） |

`isHoliday` は [`@holiday-jp/holiday_jp`](https://github.com/holiday-jp/holiday_jp-js) を使う。利用時のみ peer dep を入れる:

```sh
npm install @holiday-jp/holiday_jp
```

```ts
import { Day } from 'koyomify';
import { era } from 'koyomify/locale/jp/era';
import { isHoliday } from 'koyomify/locale/jp/holiday';

era(new Day('2019-05-01'));          // ['令和', 1]
new Day('2026-01-01').$(isHoliday);  // true (元日)
new Day('2026-05-04').$(isHoliday);  // true (みどりの日)
new Day('2026-05-06').$(isHoliday);  // true (振替休日)
```

### 他の国を追加するには

未提供の国は、自分で `(d: Day) => boolean` を書けば良い。コアは locale ロジックを持たないので fork は不要:

```ts
import Holidays from 'date-holidays';
import type { Day } from 'koyomify';

const us = new Holidays('US');
export const isHolidayUS = (d: Day): boolean => Boolean(us.isHoliday(d.toDate()));
```

`koyomify` 本体に同梱したい場合は `src/locale/<cc>/<feature>.ts` で `(d: Day) => T` を export する形で contribute する（`koyomify/locale/jp/*` と同じ shape）。

## レシピ集

### 月末営業日

```ts
import { Day, endOfMonth, prev, isWeekend, eq } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp/holiday';

const isLastBusinessDayOfMonth = (d: Day): boolean => {
  let last = d.$(endOfMonth);
  while (last.$(isWeekend) || last.$(isHoliday)) last = last.$(prev);
  return d.$(eq(last));
};
```

### 翌月の第 1 営業日

```ts
import { Day, month, beginOfMonth, next, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp/holiday';

const firstBusinessDayOfNextMonth = (d: Day): Day => {
  let x = d.$(month(+1)).$(beginOfMonth);
  while (x.$(isWeekend) || x.$(isHoliday)) x = x.$(next);
  return x;
};
```

### N 営業日後

```ts
import { Day, next, isWeekend } from 'koyomify';
import { isHoliday } from 'koyomify/locale/jp/holiday';

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
- バンドラの tree-shaking が未使用サブパスを除去。`import { Day } from 'koyomify'` だけなら JSON DSL も祝日データもバンドルに入らない
- Node SSR / 非バンドル環境でもサブパスは別 JS ファイルなので、`koyomify/locale/jp/holiday`（と `@holiday-jp/holiday_jp` の import）は import した時にだけロードされる。`koyomify/locale/jp/era` を import しても祝日データは読み込まれない
- `@holiday-jp/holiday_jp` を **optional な peerDependency** にしてあるので、祝日が要らない人は実物を持たなくて良い

## 開発

```sh
pnpm install
pnpm build
```

### サンプル実行

`examples/` 配下に実行可能スクリプトを置いている（`tsx` で実行）:

```sh
pnpm example:basic           # コンストラクタ / getter / shift / 述語 / 比較
pnpm example:ferry           # フェリーダイヤルール（パイプライン形式）
pnpm example:match           # 同ルール（match DSL 形式）
pnpm example:business-days   # 月末営業日 / 翌月第1営業日 / N営業日後
pnpm example:era             # 和暦（locale/jp）
```

業種別シナリオ (`examples/business/`):

```sh
pnpm example:bar       # バーの営業カレンダー（定休・ライブ・お盆・年末年始）
pnpm example:etc       # ETC 休日割引カレンダー（シルバーウィーク連休検出）
pnpm example:kaikatsu  # ネカフェ平日／休日料金カレンダー（GW で揺れる料金）
pnpm example:karaoke   # カラオケの日別お得情報（レディースデー・シニアデー・年末年始）
```

## ライセンス

MIT
