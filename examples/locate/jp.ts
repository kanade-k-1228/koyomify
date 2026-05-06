import { Day } from "../../src/index.js";
import { era, isHoliday } from "../../src/locale/jp/index.js";

const samples = [
  "1900-01-01",
  "1926-12-25", // 昭和元年
  "1989-01-08", // 平成開始日
  "2019-04-30", // 平成最終日
  "2019-05-01", // 令和開始日
  "2026-05-06", // 休日
];

for (const ds of samples) {
  const d = new Day(ds);
  const [name, year] = era(d);
  console.log(`${ds} → ${name}${year}年   isHoliday: ${isHoliday(d)}`);
}
