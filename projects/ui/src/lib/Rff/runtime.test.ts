import {
  resolveRffAnnouncementUrl,
  resolveRffApiUrl,
} from './runtime';

describe('RFF runtime configuration', () => {
  it('uses deployed defaults when Netlify variables are absent', () => {
    expect(resolveRffApiUrl(undefined, false)).toBe(
      'https://rff-staging.bean.money'
    );
    expect(resolveRffAnnouncementUrl(undefined)).toBe(
      'https://github.com/BeanstalkFarms/Beanstalk/issues/1189'
    );
  });

  it('keeps the local API proxy and honors deployment overrides', () => {
    expect(resolveRffApiUrl(undefined, true)).toBe('/rff-api');
    expect(resolveRffApiUrl(' https://rff.example.com ', false)).toBe(
      'https://rff.example.com'
    );
    expect(resolveRffAnnouncementUrl(' https://example.com/ebip ')).toBe(
      'https://example.com/ebip'
    );
  });
});
