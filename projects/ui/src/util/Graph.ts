type BinarySearchAccessor<T> = T extends number ? never : (a: T) => number;

// Binary search function for some data that has a season field
export function binarySearchSeasons<T>(
  array: T[],
  target: number,
  compare: (a: number, b: number) => number,
  accessor?: BinarySearchAccessor<T>
): number {
  let low = 0;
  let high = array.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value =
      typeof array[mid] !== 'number' && accessor
        ? accessor(array[mid])
        : (array[mid] as number);
    const cmp = compare(value, target);

    if (cmp === 0) {
      return mid;
    }
    if (cmp < 0) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return high;
}

const RESEED_SEASON_TIMESTAMP = 1728525600;

function getNow2ReseedSeasonsDiff() {
  const now = Math.floor(new Date().getTime() / 1000);
  const secondsDiff = now - RESEED_SEASON_TIMESTAMP;

  return Math.floor(secondsDiff / 60 / 60);
}
