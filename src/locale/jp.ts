import { Day, year } from '../index.js';
import holiday_jp from '@holiday-jp/holiday_jp';

export const isHoliday = (d: Day): boolean => holiday_jp.isHoliday(d.toDate());

const ERAS: { name: string; start: number; startYear: number }[] = [
  { name: '令和', start: Day.from('2019-05-01').n, startYear: 2019 },
  { name: '平成', start: Day.from('1989-01-08').n, startYear: 1989 },
  { name: '昭和', start: Day.from('1926-12-25').n, startYear: 1926 },
  { name: '大正', start: Day.from('1912-07-30').n, startYear: 1912 },
  { name: '明治', start: Day.from('1868-10-23').n, startYear: 1868 },
];

export const era = (d: Day): [string, number] => {
  for (const e of ERAS) {
    if (d.n >= e.start) return [e.name, year(d) - e.startYear + 1];
  }
  throw new Error(`era: unsupported date ${d.toString()}`);
};
