import { SeasonDataPoint } from '~/components/Common/Charts/SeasonPlot';

/**
 * Normalize season to a number. GraphQL can return either a number or a nested object
 * like { season: number }, depending on which subgrpah is queried.
 */
export function toSeasonNumber(
  s: number | { season?: number } | undefined
): number {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  if (
    typeof s === 'object' &&
    typeof (s as { season?: number }).season === 'number'
  ) {
    return (s as { season: number }).season;
  }
  return 0;
}

/**
 * Sort Season data points from oldest to newest.
 * If two data points have the same season, use the included `date`.
 */
export const sortSeasons = <T extends Omit<SeasonDataPoint, 'value'>>(
  a: T,
  b: T
) => {
  const diff = toSeasonNumber(a.season) - toSeasonNumber(b.season); // 6074 - 6073 = +1 -> put a after b
  if (diff !== 0) return diff; //
  if (!a.date || !b.date) return 0;
  return a.date > b.date ? 1 : -1; // 8/8 > 8/7 => +1 -> put a after b
};
