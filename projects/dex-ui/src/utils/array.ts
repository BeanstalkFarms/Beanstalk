import { TokenValue } from "@beanstalk/sdk-core";

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  // use TV here to avoid floating point errors
  const len = TokenValue.fromHuman(array.length, 0);
  const length = Math.ceil(len.div(chunkSize).toNumber());

  return Array.from({ length: length }, (_, index) =>
    array.slice(index * chunkSize, (index + 1) * chunkSize)
  );
}
