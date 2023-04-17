import { Crate, DepositCrate } from '~/state/farmer/silo';

/**
 * Order crates by Season.
 */
export function sortCratesBySeason<T extends Crate>(crates: T[], direction : 'asc' | 'desc' = 'desc') {
  const m = direction === 'asc' ? -1 : 1;
  return [...crates].sort((a, b) => m * (b.season.minus(a.season).toNumber()));
}

/**
 * Order crates by BDV.
 */
export function sortCratesByBDVRatio<T extends DepositCrate>(crates: T[], direction : 'asc' | 'desc' = 'asc') {
  const m = direction === 'asc' ? -1 : 1;
  return [...crates].sort((a, b) => {
    const _a = a.bdv.div(a.amount);
    const _b = b.bdv.div(b.amount);
    return m * _b.minus(_a).toNumber();
  });
}
