export const sleep = (ms: number = 1000) => new Promise<void>((r) => setTimeout(() => { r(); }, ms));

export const secondsToDate = (ts: string) => new Date(parseInt(ts, 10) * 1000);

export const getDateCountdown = (
  /** ms since epoch; getTime() */
  time: number 
) => {
  /// Dates
  let msg;
  const now = new Date();
  const end = new Date(time);

  /// Calculations
  const differenceInTime  = end.getTime() - now.getTime();
  const differenceInHours = differenceInTime / (1000 * 3600);
  const differenceInDays  = differenceInHours / 24;
  now.setHours(0, 0, 0, 0);

  const active = differenceInHours > 0;

  /// Date is in the future
  if (active) {
    if (differenceInHours <= 1) {
      // less than one hour away
      msg = `in ${Math.round(differenceInHours * 60)} minutes`;
    } else if (Math.round(differenceInHours) === 1) {
      // exactly one hour away
      msg = `in ${Math.round(differenceInHours)} hour`;
    } else if (differenceInHours > 1 && differenceInHours <= 24) {
      // less than one day away
      msg = `in ${Math.round(differenceInHours)} hours`;
    } else if (differenceInHours > 24 && differenceInHours <= 48) {
      // 1-2 days away
      const diff = Math.round(differenceInHours - 24);
      msg = `in ${Math.round(differenceInDays)} day, ${diff} hour${diff === 1 ? '' : 's'}`;
    } else if (differenceInHours > 48 && differenceInDays <= 7) {
      // less than one week away
      msg = `in ${Math.round(differenceInDays)} days`;
    } else if (differenceInDays > 7) {
      // greater than one week away
      msg = `on ${end.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
    }
  } else {
    // in the past
    msg = `on ${end.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`;
  }

  return [msg, active] as const;
};
