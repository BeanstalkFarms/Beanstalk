export const GRID_UNIT = 8;

export const themeSpacing = (...args: number[]): string =>
  args
    .slice(0, 4)
    .reduce((str, pts) => `${str} ${pts * GRID_UNIT}px`, "")
    .trim();
