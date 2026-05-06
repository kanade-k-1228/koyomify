import type { Day } from '../index.js';
import holiday_jp from '@holiday-jp/holiday_jp';

export const isHoliday = (d: Day): boolean => holiday_jp.isHoliday(d.toDate());
