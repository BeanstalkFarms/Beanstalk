import { ethers } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";

enum ClipboardType {
  STATIC = 0, // no bytes are copied; static call
  SINGLE = 1, // 1 bytes32 pasted from previous call
  MULTI = 2 // n bytes32 pasted from previous call
}

type PasteParams = Readonly<
  [
    /** what Pipe to Copy from */
    returnDataIndex: number,
    /** index in returnData to copy from */
    copyIndex: number,
    /** index in callData to paste into */
    pasteIndex: number
  ]
>;

type PasteParamsByType = {
  [ClipboardType.STATIC]: Readonly<[]>;
  [ClipboardType.SINGLE]: Readonly<PasteParams>;
  [ClipboardType.MULTI]: Readonly<PasteParams[]>;
};

export class Clipboard {
  /**
   * Encode "advanced data" for copying calldata between pipeline calls.
   *
   * @note calldata byte positions use their "assembly" indices.
   *
   * - for the "copyIndex" encoded in `copyData[1]`, bytes 0-31 encode
   *   the length of the return tuple. the first element is stored at
   *   byte 32.
   *
   * - for the "pasteIndex" encoded in `copyData[2]`, bytes 0-3 encode
   *   the function signature and bytes 4-35 encode the length of the following
   *   data. so the first slot begins at index 36:
   *   - `0x` (0x is trimmed in solidity)
   *   - `ab01cd23` (first 8 hex characters = 4 bytes is the length of data)
   *   - `0000....` (next 64 hex characters = 32 bytes is first element)
   */
  public static encode(pasteParams: PasteParamsByType[ClipboardType], etherValue: ethers.BigNumber = ethers.BigNumber.from(0)) {
    let type: number;
    if (pasteParams.length === 0) {
      type = 0; // static
    } else if (!Array.isArray(pasteParams[0])) {
      type = 1; // single
    } else {
      type = 2; // multi
    }
    const { types, encodeData } = Clipboard.prepare(type, pasteParams, etherValue);
    return defaultAbiCoder.encode(types, encodeData);
  }

  /**
   * @fixme assert all params are integers
   * @param returnDataIndex
   * @param copySlot
   * @param pasteSlot
   * @returns
   */
  public static encodeSlot(
    returnDataIndex: number,
    copySlot: number,
    pasteSlot: number,
    etherValue: ethers.BigNumber = ethers.BigNumber.from(0)
  ) {
    return Clipboard.encode([returnDataIndex, 32 + copySlot * 32, 4 + 32 + pasteSlot * 32], etherValue);
  }

  //////////////////////// INTERNAL ////////////////////////

  /**
   * Pack a Paste operation.
   *
   * @dev preBytes is optional and should be used if the function call performs exactly 1 data copy operation
   * in which case it should be set to `0x0${type}0${useEtherFlag}`
   * where type is 0, 1 or 2 and useEtherFlag is 0 or 1.
   */
  private static pack(params: PasteParams, preBytes: string = "0x0000") {
    return ethers.utils.solidityPack(["bytes2", "uint80", "uint80", "uint80"], [preBytes, params[0], params[1], params[2]]);
  }

  /**
   * Prepare types and packed data for a Paste operation.
   */
  private static prepare<T extends ClipboardType>(type: T, pasteParams: PasteParamsByType[T], etherValue: ethers.BigNumber) {
    let hasValue = etherValue.gt(0);
    let types: string[] = [];
    let encodeData: (string | string[])[] = [];
    let typeBytes = `0x0${type}0${hasValue ? 1 : 0}`;

    switch (type) {
      case 0: {
        types.push("bytes2");
        encodeData.push(typeBytes);
        break;
      }
      case 1: {
        types.push("bytes32");
        encodeData.push(
          // pack `typeBytes` into the first slot of this value
          Clipboard.pack(pasteParams as PasteParams, typeBytes)
        );
        break;
      }
      case 2: {
        types = types.concat(["bytes2", "uint256[]"]);
        encodeData = encodeData.concat([
          typeBytes,
          // `typeBytes` held in independent slot, pack empty bytes for items in array
          (pasteParams as PasteParams[]).map((d) => Clipboard.pack(d))
        ]);
        break;
      }
      default: {
        throw new Error(`Clipboard: Unrecognized advanced data type ${type}`);
      }
    }

    if (hasValue) {
      types.push("uint256");
      encodeData.push(etherValue.toString());
    }

    return { types, encodeData };
  }
}
