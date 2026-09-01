import { getRemoteBuildId } from './AppVersion';

describe('app version payloads', () => {
  it('accepts a non-empty remote build id', () => {
    expect(getRemoteBuildId({ buildId: 'deploy-123' })).toBe('deploy-123');
  });

  it('ignores malformed version payloads', () => {
    expect(getRemoteBuildId(null)).toBeUndefined();
    expect(getRemoteBuildId({})).toBeUndefined();
    expect(getRemoteBuildId({ buildId: 123 })).toBeUndefined();
    expect(getRemoteBuildId({ buildId: '   ' })).toBeUndefined();
  });
});
