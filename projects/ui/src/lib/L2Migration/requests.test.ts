import {
  createRequestScope,
  fetchL2MigrationData,
  readStoredMigrationSource,
} from './requests';

const SOURCE = '0x1111111111111111111111111111111111111111';
const RECEIVER = '0x2222222222222222222222222222222222222222';

describe('L2 migration request scoping', () => {
  it('lets a new wallet supersede an in-flight request without being cleared by it', () => {
    const scope = createRequestScope();
    const oldRequest = scope.begin('old-wallet');
    const duplicateOldRequest = scope.begin('old-wallet');
    const newRequest = scope.begin('new-wallet');

    expect(oldRequest).toBeDefined();
    expect(duplicateOldRequest).toBeUndefined();
    expect(newRequest).toBeDefined();
    expect(scope.isCurrent(oldRequest!)).toBe(false);
    expect(scope.isCurrent(newRequest!)).toBe(true);

    scope.finish(oldRequest!);
    expect(scope.isCurrent(newRequest!)).toBe(true);

    scope.finish(newRequest!);
    expect(scope.begin('new-wallet')).toBeDefined();
  });
});

describe('L2 migration request safety', () => {
  it('falls back to chain discovery when browser storage is unavailable', () => {
    expect(
      readStoredMigrationSource(() => {
        throw new DOMException('blocked', 'SecurityError');
      }, RECEIVER)
    ).toBeUndefined();
  });

  it('rejects non-success migration API responses', async () => {
    const fetcher = async () =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response;

    await expect(
      fetchL2MigrationData(SOURCE, undefined, fetcher)
    ).rejects.toThrow('503');
  });
});
