import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";

export const ADDRESS_ZERO = Address.fromString("0x0000000000000000000000000000000000000000");

export function Bytes4_emptySelector(b: Bytes): boolean {
  return b == Bytes.fromHexString("0x00000000");
}

// For using the graph's Bytes in big endian format
export function BigInt_bigEndian(s: string): BigInt {
  return BigInt.fromUnsignedBytes(Bytes_bigEndian(s));
}

export function Bytes_bigEndian(s: string): Bytes {
  return Bytes.fromUint8Array(Bytes.fromHexString(s).reverse());
}

export function toAddress(b: Bytes): Address {
  return Address.fromBytes(b);
}

export function toAddressArray(b: Bytes[]): Address[] {
  const retval: Address[] = [];
  for (let i = 0; i < b.length; ++i) {
    retval.push(Address.fromBytes(b[i]));
  }
  return retval;
}

export function toBytesArray(a: Address[]): Bytes[] {
  const retval: Bytes[] = [];
  for (let i = 0; i < a.length; ++i) {
    retval.push(a[i]);
  }
  return retval;
}
