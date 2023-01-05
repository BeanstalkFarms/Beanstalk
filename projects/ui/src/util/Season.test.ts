import { sortSeasons } from '~/util/Season';
import type { SeasonDataPoint } from '~/components/Common/Charts/SeasonPlot';

describe('data prep', () => {
  it('sorts seasons', () => {
    const p1 = {
      date: new Date('2022-08-08T00:00:00.000'),
      season: 6074,
      value: 1,
    } as unknown as SeasonDataPoint;
    const p2 = {
      date: new Date('2022-08-08T00:01:00.000'),
      season: 6074,
      value: 2,
    } as unknown as SeasonDataPoint;
    const p3 = {
      date: new Date('2022-08-08T00:01:00.000'),
      season: 6075,
      value: 2,
    } as unknown as SeasonDataPoint;
    const d1 : SeasonDataPoint[] = [p1, p2, p3];
    const d2 : SeasonDataPoint[] = [p2, p1, p3];
    expect(d1.sort(sortSeasons)).toStrictEqual([p1, p2, p3]);
    expect(d2.sort(sortSeasons)).toStrictEqual([p1, p2, p3]);
  });
});
