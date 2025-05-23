import BigNumber from 'bignumber.js';
/**
 * converts hex string to rgba
 */
export const hexToRgba = (hex: string, alpha?: number) => {
  const stripped = hex.replace('#', '').split('');
  if (stripped.length % 3 !== 0 || stripped.length > 6) {
    throw new Error(`unexpected invalid hex value: ${hex}`);
  }

  const isCondensedHex = stripped.length === 3;
  const hexArr = stripped
    .reduce((prev, curr) => {
      if (isCondensedHex) {
        prev += curr;
      }
      prev += curr;
      return prev;
    }, '' as string)
    .toString();

  const r = parseInt(hexArr.slice(0, 2), 16);
  const g = parseInt(hexArr.slice(2, 4), 16);
  const b = parseInt(hexArr.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha ?? 1})`;
};

/**
 * valid input examples:
 *  - 1
 *  - "1"
 *  - "1rem"
 *  - "1em"
 * convert rem or em to px
 */
export const remToPx = (_rem: string | number) => {
  const baseFontSize = 16;
  try {
    if (typeof _rem === 'number') return _rem * baseFontSize;
    const remStrClean = (() => {
      if (_rem.includes('rem')) return _rem.replace('rem', '');
      if (_rem.includes('em')) return _rem.replace('em', '');
      return _rem;
    })().trim();

    return parseFloat(remStrClean) * baseFontSize;
  } catch (err) {
    throw new Error(`error in rem to px conversion. input: ${_rem}`);
  }
};

export function exists<T>(
  value: T | undefined | null
): value is NonNullable<T> {
  return value !== undefined && value !== null;
}

export function existsNot(value: any): value is undefined | null {
  return !exists(value);
}

export function stringsEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  // use BN here to avoid floating point errors
  const length = Math.ceil(
    new BigNumber(array.length).div(chunkSize).toNumber()
  );

  return Array.from({ length: length }, (_, index) =>
    array.slice(index * chunkSize, (index + 1) * chunkSize)
  );
}
