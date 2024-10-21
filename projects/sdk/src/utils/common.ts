export function isArray<T>(data: T | T[]): data is T[] {
  return Array.isArray(data);
}
