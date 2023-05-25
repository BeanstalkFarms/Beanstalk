export const enumFromValue = <T extends Record<number, string>>(val: number, _enum: T) => {
  // @ts-ignore
  const enumName = (Object.keys(_enum) as Array<keyof T>).find((k) => _enum[k] === val);
  if (!enumName) throw Error(`The network id ${val} is not valid`);
  return _enum[enumName];
};

export function assert(value: boolean, message?: string): asserts value;
export function assert<T>(value: T | null | undefined, message?: string): asserts value is T;
export function assert(value: any, message?: string) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message || "Assertion failed");
  }
}

export function expectInstanceOf<T extends new (...args: any[]) => any>(x: unknown, of: T): asserts x is InstanceType<T> {
  expect(x).toBeInstanceOf(of);
}

export const zeros = (numZeros: number) => "".padEnd(numZeros, "0");
