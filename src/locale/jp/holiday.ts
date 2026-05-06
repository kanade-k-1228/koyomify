import holiday_jp from "@holiday-jp/holiday_jp";
import type { Day } from "../../core.js";

export const isHoliday = (d: Day): boolean => holiday_jp.isHoliday(d.toDate());
