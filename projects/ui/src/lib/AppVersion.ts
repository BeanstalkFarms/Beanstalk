export const getRemoteBuildId = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined;

  const { buildId } = value as { buildId?: unknown };
  return typeof buildId === 'string' && buildId.trim()
    ? buildId.trim()
    : undefined;
};
