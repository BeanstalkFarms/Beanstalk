import { Bytes, BigInt, log } from "@graphprotocol/graph-ts";

// Cumulative Well reserves are abi encoded as a bytes16[]. This decodes into BigInt[]
export function decodeCumulativeWellReserves(data: Bytes): BigInt[] {
  let dataString = data.toHexString().substring(2);

  let dataStartOffset = <i32>parseInt(dataString.substring(0, <i32>64), 16) * 2;
  let arrayLength = <i32>parseInt(dataString.substring(dataStartOffset, dataStartOffset + <i32>64), 16);
  let cumulativeReserves: BigInt[] = new Array<BigInt>(arrayLength);
  let dataOffset = dataStartOffset + <i32>64;

  // log.debug("dataStartOffset {}", [dataStartOffset.toString()]);
  // log.debug("arrayLength {}", [arrayLength.toString()]);

  for (let i = 0; i < arrayLength; i++) {
    let elementOffset = dataOffset + i * 64;
    let littleEndian = Bytes.fromHexString("0x" + dataString.substring(elementOffset, elementOffset + 32)).reverse();
    let element = BigInt.fromUnsignedBytes(Bytes.fromUint8Array(littleEndian));
    // log.debug("Hex String {}", ["0x" + dataString.substring(elementOffset, elementOffset + 32)]);
    // log.debug("element val {}", [element.toString()]);
    cumulativeReserves[i] = element;
  }

  return cumulativeReserves;
}
