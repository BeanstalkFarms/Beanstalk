import { RffApiClient } from './client';

const configuredApiUrl = import.meta.env.VITE_RFF_API_URL?.trim();

export const resolveRffApiUrl = (
  configuredUrl: string | undefined,
  isDev: boolean
) =>
  configuredUrl?.trim() ||
  (isDev ? '/rff-api' : 'https://rff-staging.bean.money');

export const resolveRffAnnouncementUrl = (configuredUrl?: string) =>
  configuredUrl?.trim() ||
  'https://github.com/BeanstalkFarms/Beanstalk/issues/1189';

export const RFF_API_URL = resolveRffApiUrl(
  configuredApiUrl,
  import.meta.env.DEV
);

export const RFF_ANNOUNCEMENT_URL = resolveRffAnnouncementUrl(
  import.meta.env.VITE_RFF_ANNOUNCEMENT_URL
);

export const rffApi = new RffApiClient(RFF_API_URL);
