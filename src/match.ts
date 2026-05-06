import { Day, type Operator } from "./core.js";
import {
  beginOfMonth,
  beginOfYear,
  day,
  endOfMonth,
  endOfYear,
  isFriday,
  isMonday,
  isSaturday,
  isSunday,
  isThursday,
  isTuesday,
  isWednesday,
  isWeekday,
  isWeekend,
  month,
  nthDay,
  nthMonth,
  nthWeek,
  range,
  year,
} from "./operators.js";

// ---------------------------------------------------------------------------
// Public API

export type Pattern<T> = T | { [cond: string]: Pattern<T> };

export type EnvFn =
  | Operator<Day>
  | Operator<boolean>
  | ((...args: any[]) => Operator<Day>)
  | ((...args: any[]) => Operator<boolean>);

export const matcher = <T>(
  pat: Pattern<T>,
  env: Record<string, EnvFn> = {},
): ((d: Day) => Result<T>) => {
  const merged: Record<string, EnvFn> = { ...BUILTIN, ...env };
  const tree = compile<T>(pat, merged);
  return (d) => evaluate(tree, d);
};

// ---------------------------------------------------------------------------
// Pattern tree

type CompiledPattern<T> =
  | { kind: "leaf"; value: T }
  | { kind: "node"; pattern: { cond: Operator<boolean>; rule: CompiledPattern<T> }[] };

type Result<T> = { result: true; value: T } | { result: false };

const compile = <T>(pat: Pattern<T>, env: Record<string, EnvFn>): CompiledPattern<T> => {
  if (pat === null || typeof pat !== "object") {
    return { kind: "leaf", value: pat as T };
  }
  if (Array.isArray(pat)) {
    throw new Error("[koyomify/match] arrays are not valid pattern values");
  }
  const pattern: { cond: Operator<boolean>; rule: CompiledPattern<T> }[] = [];
  for (const [key, sub] of Object.entries(pat as Record<string, Pattern<T>>)) {
    pattern.push({
      cond: compileCond(key, env),
      rule: compile<T>(sub, env),
    });
  }
  return { kind: "node", pattern };
};

const evaluate = <T>(tree: CompiledPattern<T>, d: Day): Result<T> => {
  if (tree.kind === "leaf") return { result: true, value: tree.value };
  for (const c of tree.pattern) {
    if (c.cond(d)) {
      const r = evaluate(c.rule, d);
      if (r.result) return r;
    }
  }
  return { result: false };
};

// ---------------------------------------------------------------------------
// Cond parser
//
//   cond     := '*' | ?( '!' ) op % '.'
//   operator := range | ident ?( '(' params ')' )
//   range    := date ?( '..' date )
//   params   := value % ','
//   value    := date | number
//   date     := yyyy-mm-dd
//   ident    := [a-zA-Z_][a-zA-Z_0-9]*
//

// 内部 AST: 1 個の op
type Op = { name: string; args: (string | number)[] };

// 内部: 引数つきファクトリ（shift か predicate を返す）
type Factory<T> = (...args: (string | number)[]) => Operator<T>;

const compileCond = (src: string, env: Record<string, EnvFn>): Operator<boolean> => {
  if (src === "*") return () => true;
  const [negate, ops] = parseCond(src);
  return composeOps(negate, ops, src, env);
};

// 構文解析: src → [negate, Op[]]
const parseCond = (src: string): [boolean, Op[]] => {
  let i = 0;
  const n = src.length;

  const skipSpace = (): void => {
    while (i < n && /\s/.test(src[i]!)) i++;
  };
  const peek = (): string => (i < n ? src[i]! : "");

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

  // value := date | number。日付らしい形なら文字列のまま、それ以外は number。
  const parseValue = (): string | number => {
    skipSpace();
    const start = i;
    if (i < n && src[i] === "-") i++;
    if (i >= n || !/\d/.test(src[i]!)) {
      throw new Error(`[koyomify/match] expected value in "${src}" at offset ${i}`);
    }
    while (i < n && /[\d-]/.test(src[i]!)) i++;
    const raw = src.slice(start, i);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      throw new Error(`[koyomify/match] invalid number/date "${raw}" in "${src}"`);
    }
    return num;
  };

  // params := value % ','。'(' は呼び出し側で消費済み。
  const parseParams = (): (string | number)[] => {
    const params: (string | number)[] = [];
    skipSpace();
    while (peek() !== ")") {
      params.push(parseValue());
      skipSpace();
      if (peek() === ",") {
        i++;
        skipSpace();
      }
    }
    i++; // consume ')'
    return params;
  };

  const dateRe = /^(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?/;

  // op := range | ident ?( '(' params ')' )
  const parseOp = (): Op => {
    skipSpace();
    const m = dateRe.exec(src.slice(i));
    if (m) {
      i += m[0].length;
      return { name: "range", args: [m[1]!, m[2] ?? m[1]!] };
    }
    const name = parseIdent();
    skipSpace();
    if (peek() === "(") {
      i++;
      return { name, args: parseParams() };
    }
    return { name, args: [] };
  };

  // 先頭の '!' は述語の真偽反転フラグ
  skipSpace();
  let negate = false;
  if (peek() === "!") {
    negate = true;
    i++;
  }

  // cond rest := op % '.'
  const ops: Op[] = [parseOp()];
  while (true) {
    skipSpace();
    if (peek() !== ".") break;
    i++;
    ops.push(parseOp());
  }
  skipSpace();
  if (i < n) {
    throw new Error(`[koyomify/match] unexpected trailing input in "${src}" at offset ${i}`);
  }
  return [negate, ops];
};

// Op[] → Operator<boolean>。
// pipeline は shift* predicate の形で、最後の op が必ず述語（それ以前は shift）。
// 各 op は env から引いた関数を probe で走らせ、戻り値が Day なら shift、boolean なら predicate。
const composeOps = (
  negate: boolean,
  ops: Op[],
  src: string,
  env: Record<string, EnvFn>,
): Operator<boolean> => {
  const lookup = (name: string): EnvFn => {
    const fn = env[name];
    if (!fn) {
      throw new Error(
        `[koyomify/match] '${name}' is not registered (from "${src}"). ` +
          `Pass it via matcher(rules, { ${name}: fn }).`,
      );
    }
    return fn;
  };

  const shifts: Operator<Day>[] = [];
  let predicate: Operator<boolean> | null = null;
  const probe = new Day("2000-01-01");

  for (const op of ops) {
    if (predicate !== null) {
      throw new Error(`[koyomify/match] op after predicate in "${src}" at '${op.name}'`);
    }
    const entry = lookup(op.name);
    const fn: (d: Day) => unknown =
      op.args.length > 0
        ? (entry as Factory<Day | boolean>)(...op.args)
        : (entry as (d: Day) => unknown);

    const r = fn(probe);
    if (r instanceof Day) {
      shifts.push(fn as Operator<Day>);
    } else if (typeof r === "boolean") {
      predicate = fn as Operator<boolean>;
    } else {
      throw new Error(
        `[koyomify/match] '${op.name}' is neither a shift nor a predicate (in "${src}")`,
      );
    }
  }
  if (predicate === null) throw new Error(`[koyomify/match] empty pipeline in "${src}"`);

  const finalPred = predicate;
  return (d) => {
    let day = d;
    for (const sh of shifts) day = sh(day);
    const b = finalPred(day);
    return negate ? !b : b;
  };
};

// ---------------------------------------------------------------------------
// Builtin Operators
//
// shift / predicate / factory が混在する 1 つのテーブル。
// ユーザー提供の env も同じ shape で混ぜられる（matcher() で merge）。

const toInt = (v: string | number, name: string): number => {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`[koyomify/match] ${name}: expected integer, got ${JSON.stringify(v)}`);
  }
  return n;
};

const BUILTIN: Record<string, EnvFn> = {
  // Day => Day
  year,
  month,
  day,
  beginOfMonth,
  endOfMonth,
  beginOfYear,
  endOfYear,

  // Day => boolean
  range,

  nthWeek,
  nthMonth,
  nthDay,

  isWeekend,
  isWeekday,
  isSunday,
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
};
