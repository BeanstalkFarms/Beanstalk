import { RffApiClient } from './client';

const configuredApiUrl = import.meta.env.VITE_RFF_API_URL?.trim();

export const RFF_API_URL =
  configuredApiUrl ||
  (import.meta.env.DEV ? '/rff-api' : 'https://rff.bean.money');

export const RFF_ANNOUNCEMENT_URL =
  import.meta.env.VITE_RFF_ANNOUNCEMENT_URL?.trim() || '';

export const rffApi = new RffApiClient(RFF_API_URL);
