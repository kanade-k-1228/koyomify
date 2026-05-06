// koyomify/match — koyomify 用の JS オブジェクトベース日付マッチルール
//
// ルールはネスト可能な JS オブジェクトで表現し、キーは条件式、値はそのまま返す
// 値（leaf）または更にネストしたルールオブジェクト。挿入順に上から評価する。
// オブジェクト形式なので JSON / YAML などからパースしたものも、TS リテラル
// として直接書いたものも、同じ shape であればそのまま受け付けられる。
//   - キー '_' は常に真（else / default 相当）
//   - 親条件にマッチしてもネストした子で何も決まらない場合は、親の兄弟へフォールスルー

import type { Day } from './index.js';
import {
  day as dom, week as dow, month, year,
  shift, inRange, nthDow,
  isWeekend, isWeekday,
} from './index.js';

export type Value = string | number | boolean | null;
export type Predicate = (d: Day) => boolean;

export type Rule = Value | RuleMap;
export interface RuleMap { [cond: string]: Rule }

export interface CompileOptions {
  /**
   * `holiday` などの述語名を関数に解決するためのテーブル。
   * 曜日名 (`monday`...`sunday`) / `weekend` / `weekday` / `isWeekend` /
   * `isWeekday` は組み込み。
   */
  predicates?: Record<string, Predicate>;
}

const BUILTIN_PREDS: Record<string, Predicate> = {
  weekend: isWeekend,
  weekday: isWeekday,
  isWeekend,
  isWeekday,
  sunday:    (d) => dow(d) === 0,
  monday:    (d) => dow(d) === 1,
  tuesday:   (d) => dow(d) === 2,
  wednesday: (d) => dow(d) === 3,
  thursday:  (d) => dow(d) === 4,
  friday:    (d) => dow(d) === 5,
  saturday:  (d) => dow(d) === 6,
};

// ---- Condition string parser -----------------------------------------
//
// 文法（簡略）:
//   cond     := shift* atom modifier*
//   shift    := ('prev' | 'next') '.'
//   atom     := IDENT | IDENT '(' args? ')'
//   args     := value (',' value)*
//   value    := STRING | DATE | NUMBER
//   modifier := '.' IDENT      // 現在 '.not' のみ
//   IDENT    := [a-zA-Z_][a-zA-Z_0-9]*

const compileCond = (
  src: string,
  preds: Record<string, Predicate>,
): Predicate => {
  if (src === '_') return () => true;

  let i = 0;
  const n = src.length;

  const skipSpace = (): void => {
    while (i < n && /\s/.test(src[i]!)) i++;
  };

  const peek = (): string => (i < n ? src[i]! : '');

  const parseIdent = (): string => {
    skipSpace();
    const start = i;
    if (i < n && /[a-zA-Z_]/.test(src[i]!)) {
      i++;
      while (i < n && /[a-zA-Z_0-9]/.test(src[i]!)) i++;
    }
    if (start === i) {
      throw new Error(`[koyomify/match] expected identifier at offset ${i} of "${src}"`);
    }
    return src.slice(start, i);
  };

  const parseArg = (): string | number => {
    skipSpace();
    const c = peek();
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      const start = i;
      while (i < n && src[i] !== quote) i++;
      if (i >= n) {
        throw new Error(`[koyomify/match] unterminated string in "${src}"`);
      }
      const s = src.slice(start, i);
      i++;
      return s;
    }
    if (/[\d-]/.test(c)) {
      const start = i;
      // 数値または ISO 日付。'-' と数字の連なりを丸ごと取り、形を見て判別する
      if (src[i] === '-') i++;
      while (i < n && /[\d-]/.test(src[i]!)) i++;
      const raw = src.slice(start, i);
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new Error(`[koyomify/match] invalid number/date "${raw}" in "${src}"`);
      }
      return num;
    }
    throw new Error(`[koyomify/match] expected value in "${src}" at offset ${i}`);
  };

  const parseArgs = (): (string | number)[] => {
    skipSpace();
    if (peek() !== '(') {
      throw new Error(`[koyomify/match] expected '(' in "${src}"`);
    }
    i++;
    const args: (string | number)[] = [];
    skipSpace();
    while (peek() !== ')') {
      args.push(parseArg());
      skipSpace();
      if (peek() === ',') { i++; skipSpace(); }
    }
    i++;
    return args;
  };

  // 1) 先頭の prev. / next. シフト（連結可能）
  let shiftDays = 0;
  while (true) {
    skipSpace();
    if (src.startsWith('prev.', i)) { shiftDays--; i += 5; continue; }
    if (src.startsWith('next.', i)) { shiftDays++; i += 5; continue; }
    break;
  }

  // 2) atom（識別子 or 関数呼び出し）
  const head = parseIdent();
  let pred: Predicate;
  skipSpace();
  if (peek() === '(') {
    pred = makeFnPred(head, parseArgs(), src);
  } else {
    const fn = preds[head];
    if (!fn) {
      throw new Error(
        `[koyomify/match] predicate '${head}' is not registered (from "${src}"). ` +
        `Pass it via compile(rules, { predicates: { ${head}: fn } }).`,
      );
    }
    pred = fn;
  }

  // 3) 後続の修飾子（現状 .not のみ）
  while (true) {
    skipSpace();
    if (peek() !== '.') break;
    i++;
    const mod = parseIdent();
    if (mod === 'not') {
      const inner = pred;
      pred = (d) => !inner(d);
    } else {
      throw new Error(`[koyomify/match] unknown modifier '.${mod}' in "${src}"`);
    }
  }

  if (shiftDays !== 0) {
    const inner = pred;
    const days = shiftDays;
    pred = (d) => inner(shift(days)(d));
  }

  skipSpace();
  if (i < n) {
    throw new Error(`[koyomify/match] unexpected trailing input in "${src}" at offset ${i}`);
  }
  return pred;
};

const toInt = (v: string | number, name: string, src: string): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`[koyomify/match] ${name}: expected integer, got ${JSON.stringify(v)} in "${src}"`);
  }
  return n;
};

const makeFnPred = (
  name: string,
  args: (string | number)[],
  src: string,
): Predicate => {
  switch (name) {
    case 'range': {
      if (args.length !== 2 || typeof args[0] !== 'string' || typeof args[1] !== 'string') {
        throw new Error(`[koyomify/match] range(from, to) expects two date strings in "${src}"`);
      }
      return inRange(args[0], args[1]);
    }
    case 'nth': {
      if (args.length !== 2) {
        throw new Error(`[koyomify/match] nth(n, w) expects 2 integers in "${src}"`);
      }
      const nv = toInt(args[0]!, 'nth', src);
      const wv = toInt(args[1]!, 'nth', src);
      return nthDow(nv, wv);
    }
    case 'dow': {
      const vs = args.map(a => toInt(a, 'dow', src));
      return (d) => vs.includes(dow(d));
    }
    case 'dom': {
      const vs = args.map(a => toInt(a, 'dom', src));
      return (d) => vs.includes(dom(d));
    }
    case 'month': {
      const vs = args.map(a => toInt(a, 'month', src));
      return (d) => vs.includes(month(d));
    }
    case 'year': {
      const vs = args.map(a => toInt(a, 'year', src));
      return (d) => vs.includes(year(d));
    }
    default:
      throw new Error(`[koyomify/match] unknown function '${name}' in "${src}"`);
  }
};

// ---- Compiled rule tree ----------------------------------------------

type CompiledRule =
  | { kind: 'leaf'; value: Value }
  | { kind: 'branch'; cases: { pred: Predicate; rule: CompiledRule }[] };

const compileTree = (
  rule: Rule,
  preds: Record<string, Predicate>,
): CompiledRule => {
  if (rule === null || typeof rule !== 'object') {
    return { kind: 'leaf', value: rule };
  }
  if (Array.isArray(rule)) {
    throw new Error('[koyomify/match] arrays are not valid rule values');
  }
  const cases: { pred: Predicate; rule: CompiledRule }[] = [];
  for (const [key, sub] of Object.entries(rule)) {
    cases.push({
      pred: compileCond(key, preds),
      rule: compileTree(sub, preds),
    });
  }
  return { kind: 'branch', cases };
};

type EvalResult = { matched: true; value: Value } | { matched: false };

const runTree = (tree: CompiledRule, d: Day): EvalResult => {
  if (tree.kind === 'leaf') return { matched: true, value: tree.value };
  for (const c of tree.cases) {
    if (c.pred(d)) {
      const r = runTree(c.rule, d);
      if (r.matched) return r;
    }
  }
  return { matched: false };
};

// ---- Public API ------------------------------------------------------

export const compile = (
  rule: Rule,
  options: CompileOptions = {},
): ((d: Day) => Value) => {
  const preds = { ...BUILTIN_PREDS, ...options.predicates };
  const tree = compileTree(rule, preds);
  return (d) => {
    const r = runTree(tree, d);
    if (!r.matched) {
      throw new Error(`[koyomify/match] no rule matched for ${d.toString()}`);
    }
    return r.value;
  };
};

export const evaluate = (
  rule: Rule,
  d: Day,
  options: CompileOptions = {},
): Value => compile(rule, options)(d);
