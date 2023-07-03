import { Crate, DepositCrate } from '~/state/farmer/silo';

/**
 * Order crates by Season.
 */
export function sortCratesBySeason<T extends Crate>(
  crates: T[],
  direction: 'asc' | 'desc' = 'desc'
) {
  const m = direction === 'asc' ? -1 : 1;
  return [...crates].sort((a, b) => m * b.season.minus(a.season).toNumber());
}

/**
 * Order crates by BDV.
 */
export function sortCratesByBDVRatio<T extends DepositCrate>(
  crates: T[],
  direction: 'asc' | 'desc' = 'asc'
) {
  const m = direction === 'asc' ? -1 : 1;
  return [...crates].sort((a, b) => {
    const _a = a.bdv.div(a.amount);
    const _b = b.bdv.div(b.amount);
    return m * _b.minus(_a).toNumber();
  });
}

/**
 * Order crates by what's best to convert. 
 * 
 * Pre Silo V3, the season sorting is important to minimize potential stalk loss.
 * After Silo V3, BDV ratio is the only thing that matters.
 */
export function sortConvertCratesByBest<T extends DepositCrate>(
  crates: T[],
) {
  return [...crates].sort((a, b) => {
    // Calculate the BDV ratio for each crate.
    // Fix to 4 decimal places to avoid small rounding differences from resorting.
    const _a = Number(a.bdv.div(a.amount).toPrecision(4));
    const _b = Number(b.bdv.div(b.amount).toPrecision(4));

    // sorting a - b puts lowest ratio crates first, which is desirable
    const delta = _a - _b;

    // If the BDV ratio is the same, sort more recent seasons (higher numbers) first.
    // All else equal, pre-Silo V3 users would rather convert more recent crates.
    if (delta === 0) {
      // sorting b.season - a.season sorts higher (more recent) seasons first,
      // which is desirable
      return b.season.minus(a.season).toNumber();
    }

    return delta;
  });
}
