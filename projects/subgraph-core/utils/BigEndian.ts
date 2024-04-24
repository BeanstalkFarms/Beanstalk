import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// For using the graph's Bytes in big endian format
export function BigInt_bigEndian(s: string): BigInt {
  return BigInt.fromUnsignedBytes(Bytes_bigEndian(s));
}

export function Bytes_bigEndian(s: string): Bytes {
  return Bytes.fromUint8Array(Bytes.fromHexString(s).reverse());
}
