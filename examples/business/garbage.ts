import pc from "picocolors";
import { Day, day, matcher, month } from "../../src/index.js";
import { WeekdayNameShort } from "../../src/locale/jp/index.js";

// ゴミ収集カレンダー
//
//   月・木:        燃えるゴミ
//   火:            プラスチック
//   金:            ペットボトル
//   第 1・3 水曜:  缶・びん
//   第 2・4 水曜:  不燃ゴミ
//   第 5 水曜・土日: 収集なし
//   12/29–1/3:     年末年始 休止

type Garbage = "none" | "burnable" | "plastic" | "pet" | "bottle" | "nonburnable";

const schedule = matcher<Garbage>({
  "2025-12-29..2026-01-03": "none",
  isWednesday: {
    "nthWeek(1)": "bottle",
    "nthWeek(3)": "bottle",
    "nthWeek(2)": "nonburnable",
    "nthWeek(4)": "nonburnable",
  },
  isMonday: "burnable",
  isThursday: "burnable",
  isTuesday: "plastic",
  isFriday: "pet",
  "*": "none",
});

const fmt: Record<Garbage, (s: string) => string> = {
  burnable: (s) => pc.bold(pc.red(s)),
  plastic: (s) => pc.bold(pc.magenta(s)),
  pet: (s) => pc.bold(pc.cyan(s)),
  bottle: (s) => pc.bold(pc.green(s)),
  nonburnable: (s) => pc.bold(pc.yellow(s)),
  none: (s) => pc.gray(s),
};

const LABEL: Record<Garbage, string> = {
  burnable: "🔥 燃えるゴミ (月・木)",
  plastic: "🛍 プラスチック (火)",
  pet: "🥤 ペットボトル (金)",
  bottle: "🥫 缶・びん (第 1・3 水)",
  nonburnable: "🪨 不燃ゴミ (第 2・4 水)",
  none: "— 収集なし (土日 / 第 5 水 / 年末年始)",
};

// 凡例
console.log("凡例:");
for (const k of Object.keys(LABEL) as Garbage[]) {
  console.log(`  ${fmt[k]("00")}   ${LABEL[k]}`);
}
console.log();

// カレンダー（12/2025 - 2/2026 の 3 か月分。各セル = 4 ASCII カラム）
const months: Array<[number, number]> = [
  [2025, 12],
  [2026, 1],
  [2026, 2],
];
for (const [y, mo] of months) {
  const first = new Day(`${y}-${String(mo).padStart(2, "0")}-01`);
  const last = first.$(month(+1)).$(day(-1));
  const firstSun = new Day(first.n - first.week);
  const weeks = Math.ceil((last.n - firstSun.n + 1) / 7);

  console.log(`=== ${first.year}-${String(first.month).padStart(2, "0")} ===`);
  console.log(WeekdayNameShort.join("  "));

  for (let w = 0; w < weeks; w++) {
    let row = "";
    for (let dow = 0; dow < 7; dow++) {
      const d = new Day(firstSun.n + w * 7 + dow);
      const inMonth = d.n >= first.n && d.n <= last.n;
      if (!inMonth) {
        row += "    ";
      } else {
        const r = schedule(d);
        const kind: Garbage = r.result ? r.value : "none";
        row += `${fmt[kind](d.date.toString().padStart(2))}  `;
      }
    }
    console.log(row.trimEnd());
  }
  console.log();
}
