import { SeasonDataPoint } from '~/components/Common/Charts/SeasonPlot';

/**
 * Sort Season data points from oldest to newest.
 * If two data points have the same season, use the included `date`.
 */
export const sortSeasons = <T extends Omit<SeasonDataPoint, 'value'>>(a: T, b: T) => {
  const diff = a.season - b.season; // 6074 - 6073 = +1 -> put a after b
  if (diff !== 0) return diff;      //
  if (!a.date || !b.date) return 0;
  return a.date > b.date ? 1 : -1;  // 8/8 > 8/7 => +1 -> put a after b
};
