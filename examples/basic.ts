import {
  before,
  beginOfMonth,
  Day,
  day,
  daysTo,
  endOfMonth,
  eq,
  isWeekend,
  month,
} from "../src/index.js";

const d = new Day("2026-08-15");

console.log("--- getters ---");
console.log("toString :", d.toString()); // 2026-08-15
console.log("year     :", d.year); // 2026
console.log("month    :", d.month); // 8
console.log("date     :", d.date); // 15
console.log("week     :", d.week); // 6 (土)
console.log("n        :", d.n); // UTC days since 1970-01-01

console.log("\n--- shifts ---");
console.log("+2 month   :", d.$(month(+2)).toString()); // 2026-10-15
console.log("beginOfMon :", d.$(beginOfMonth).toString()); // 2026-08-01
console.log("endOfMon   :", d.$(endOfMonth).toString()); // 2026-08-31
console.log("day(+7)    :", d.$(day(+7)).toString()); // 2026-08-22

console.log("\n--- chained pipeline ---");
console.log(
  d.$(month(+2)).$(beginOfMonth).$(day(-1)).toString(), // 2026-09-30
);

console.log("\n--- predicates ---");
console.log("isWeekend  :", d.$(isWeekend)); // true (土曜)

console.log("\n--- comparisons via valueOf ---");
const a = new Day("2026-01-01");
const b = new Day("2026-12-31");
console.log("a < b           :", a < b); // true
console.log("+b - +a (days)  :", +b - +a); // 364 (valueOf)
console.log("a.$(eq(a))      :", a.$(eq(a))); // true
console.log("a.$(before(b))  :", a.$(before(b))); // true
console.log("a.$(daysTo(b))  :", a.$(daysTo(b))); // 364

console.log("\n--- constructor variants ---");
console.log("from string :", new Day("2026-08-15").toString());
console.log("from Date   :", new Day(new Date(2026, 7, 15)).toString());
console.log("from number :", new Day(d.n).toString());
