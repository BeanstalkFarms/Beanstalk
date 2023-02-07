export const enumFromValue = <T extends Record<number, string>>(val: number, _enum: T) => {
  // @ts-ignore
  const enumName = (Object.keys(_enum) as Array<keyof T>).find((k) => _enum[k] === val);
  if (!enumName) throw Error(`The network id ${val} is not valid`);
  return _enum[enumName];
};
