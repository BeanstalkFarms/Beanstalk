import { DateTime } from 'luxon';

const today = DateTime.now();
const N = 30;

export const mockDepositData = new Array(N).fill(null).map((_, i) => ({
  season: 6074 - N + i,
  date: today.minus({ days: N - i }).toJSDate(),
  value: 100_000 + 300 * i + 1000 * Math.random(),
}));

export const mockOwnershipPctData = new Array(N).fill(null).map((_, i) => ({
  season: 6074 - N + i,
  date: today.minus({ days: N - i }).toJSDate(),
  value: 0.01 - 0.0001 * i + 0.001 * (Math.random() - 0.5)
}));

export const mockTWAPData = new Array(N).fill(null).map((_, i) => ({
  season: 6074 - N + i,
  date: today.minus({ days: N - i }).toJSDate(),
  // value: 0.01 - 0.0001 * i + 0.001 * (Math.random() - 0.5)
  value: 1 + 0.1 * Math.random(),
}));

export const mockTWAPDataVariable = new Array(N).fill(null).map((_, i) => ({
  season: 6074 - N + i,
  date: today.minus({ days: N - i }).toJSDate(),
  // value: 0.01 - 0.0001 * i + 0.001 * (Math.random() - 0.5)
  value: (i < 15 || i > 25) ? 1 + 0.4 * Math.random() : 1 - 0.4 * Math.random(),
}));

export const mockPodRateData = new Array(N).fill(null).map((_, i) => ({
  season: 6074 - N + i,
  date: today.minus({ days: N - i }).toJSDate(),
  // value: 0.01 - 0.0001 * i + 0.001 * (Math.random() - 0.5)
  value: 1000 - i * 10 * Math.random(),
}));
