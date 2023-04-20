import { ethers } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { Clipboard } from "./clipboard";

describe("Encode", () => {
  // Type 0
  describe("prepares type 0 (empty array)", () => {
    const COPY_DATA = [] as const;
    it("prepares empty array, zero value", () => {
      const VALUE = ethers.BigNumber.from(0);

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(0, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes2");
      expect(encodeData[0]).toBe(`0x0${0}0${0}`);
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });
    it("prepares empty array, non-zero value", () => {
      const VALUE = ethers.BigNumber.from(10);

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(0, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes2");
      expect(encodeData[0]).toBe(`0x0${0}0${1}`);
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });
  });

  // Type 1
  describe("prepares type 1 (single array)", () => {
    const COPY_DATA = [4, 32, 100] as const;
    it("prepares single array, zero value", () => {
      const VALUE = ethers.BigNumber.from(0);

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(1, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes32");
      expect(encodeData[0]).toBe(
        // @ts-ignore test private function
        Clipboard.pack(COPY_DATA, `0x0${1}0${0}`)
      );
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });
    it("prepares single array, non-zero value", () => {
      const VALUE = ethers.BigNumber.from(10);

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(1, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes32");
      expect(encodeData[0]).toBe(
        // @ts-ignore test private function
        Clipboard.pack(COPY_DATA, `0x0${1}0${1}`)
      );
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });
  });

  // Type 2
  describe("prepares type 2 (nested array)", () => {
    const COPY_DATA = [[4, 32, 100] as const] as const;
    it("prepares nested array, zero value", () => {
      const VALUE = ethers.BigNumber.from(0);
      const PRE_BYTES = `0x0${2}0${0}`;

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(2, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes2");
      expect(types[1]).toBe("uint256[]");
      expect(encodeData[0]).toBe(PRE_BYTES);
      expect(encodeData[1][0]).toBe(
        // @ts-ignore test private function
        Clipboard.pack(COPY_DATA[0])
      );
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });

    it("prepares nested array, non-zero value", () => {
      const VALUE = ethers.BigNumber.from(10);
      const PRE_BYTES = `0x0${2}0${1}`;

      // @ts-ignore test private function
      const { types, encodeData } = Clipboard.prepare(2, COPY_DATA, VALUE);
      const encoded = Clipboard.encode(COPY_DATA, VALUE);

      expect(types[0]).toBe("bytes2");
      expect(types[1]).toBe("uint256[]");
      expect(encodeData[0]).toBe(PRE_BYTES);
      expect(encodeData[1][0]).toBe(
        // @ts-ignore test private function
        Clipboard.pack(COPY_DATA[0])
      );
      expect(encoded).toBe(defaultAbiCoder.encode(types, encodeData));
    });
  });
});

describe("Encode Slot", () => {
  it("correctly converts slots to byte indices", () => {
    expect(Clipboard.encode([4, 32, 100])).toStrictEqual(Clipboard.encodeSlot(4, 0, 2));
  });
});
