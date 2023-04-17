// -----------------
// Exports
// -----------------

export * from './Account';
export * from './Actions';
export * from './BeaNFTs';
export * from './BigNumber';
export * from './Chain';
export * from './Client';
export * from './Crates';
// export * from './Curve';
export * from './Farm';
export * from './Governance';
export * from './Guides';
export * from './Ledger';
export * from './Season';
export * from './State';
export * from './Time';
export * from './Tokens';

// -----------------
// Shared Types
// -----------------

export type SeasonMap<T> = { [season: string]: T; }
export type PlotMap<T>   = { [index: string]: T; }

// -----------------
// Other Helpers
// -----------------

const ordinalRulesEN = new Intl.PluralRules('en', { type: 'ordinal' });
const suffixes : { [k: string] : string } = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th'
};

export function ordinal(number: number) : string {
  const category = ordinalRulesEN.select(number);
  const suffix = suffixes[category];
  return (number + suffix);
}
