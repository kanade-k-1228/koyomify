import pc from "picocolors";
import { Day, day, isWeekend, matcher, month } from "../../src/index.js";
import { isHoliday, WeekdayNameShort } from "../../src/locale/jp/index.js";

// バーの営業時間：

type Schedule = "weekday" | "extended" | "holiday" | "live" | "close";
const schedule = matcher<Schedule>(
  {
    // 不定休
    "2026-08-13..2026-08-16": "close", // お盆
    "2025-12-29..2026-01-03": "close", // 年末年始
    "2025-07-15": "close", // 臨時休業

    // 第一金曜日はライブ
    "nthWeek(1)": { isFriday: "live" },

    // 休日営業
    off: "holiday",

    // 翌日が休日の場合は延長営業
    "day(1).off": "extended",

    // 月曜定休と振替休日
    isMonday: "close",
    isTuesday: { "day(-1).off": "close" },
    isWednesday: { "day(-1).off": { "day(-2).off": "close" } },
    isThursday: { "day(-1).off": { "day(-2).off": { "day(-3).off": "close" } } },
    isFriday: { "day(-1).off": { "day(-2).off": { "day(-3).off": { "day(-4).off": "close" } } } },

    // それ以外は平日営業
    "*": "weekday",
  },
  { off: (d: Day) => d.$(isWeekend) || d.$(isHoliday) },
);

const fmt: Record<Schedule, (dd: string) => string> = {
  weekday: (dd) => pc.bold(pc.blue(`${dd}`)), // 平日営業 (19-02)
  extended: (dd) => pc.bold(pc.yellow(`${dd}`)), // 延長営業 (19-05、平日で翌日が休日)
  holiday: (dd) => pc.bold(pc.red(`${dd}`)), // 休日営業 (15-05)
  live: (dd) => pc.bold(pc.green(`${dd}`)),
  close: (dd) => pc.gray(`${dd}`),
};

// 凡例
console.log("凡例:");
console.log(`  ${fmt.weekday("00")}   平日営業 (19:00 - 2:00)`);
console.log(`  ${fmt.extended("00")}   延長営業 (19:00 - 5:00)`);
console.log(`  ${fmt.holiday("00")}   休日営業 (15:00 - 5:00)`);
console.log(`  ${fmt.live("00")}   ライブ営業 (19:00 - 22:00)`);
console.log(`  ${fmt.close("00")}   休み`);
console.log(`  ${pc.underline("00")}   土日祝`);
console.log();

// カレンダー（7-9 月の 3 か月分。各セル = 4 ASCII カラム）
for (const m of [7, 8, 9]) {
  const first = new Day(`2026-${String(m).padStart(2, "0")}-01`);
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
        const kind: Schedule = r.result ? r.value : "weekday";
        let cell = fmt[kind](d.date.toString().padStart(2));
        if (d.$(isWeekend) || d.$(isHoliday)) cell = pc.underline(cell);
        row += `${cell}  `;
      }
    }
    console.log(row.trimEnd());
  }
  console.log();
}
