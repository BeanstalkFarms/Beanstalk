import { BigNumber, ethers } from "ethers";
import { getTestUtils } from "src/utils/TestUtils/provider";
import { Deposit } from "../silo/types";
import { calculateGrownStalkSeeds, calculateGrownStalkStems, pickCrates } from "./utils";

const { sdk } = getTestUtils();

jest.setTimeout(30000);

describe("Silo Utils", function () {
  // Crates no longer used. Switched to stems. TODO: Add some stem tests

  // describe("pickCrates()", function () {
  //   // this must be sorted by seson, DESC
  //   const crates: Deposit[] = [makeCrate(200, 10000), makeCrate(500, 9000), makeCrate(300, 8000)];

  //   it("returns one partial", async () => {
  //     const desiredAmount = sdk.tokens.BEAN.amount(100); // <= amount in first crate
  //     const pickedCrates = pickCrates(crates, desiredAmount, sdk.tokens.BEAN, 10500);

  //     expect(pickedCrates.totalAmount.eq(desiredAmount)).toBe(true);
  //     expect(pickedCrates.crates.length).toBe(1);
  //     expect(pickedCrates.crates[0]).toMatchObject({
  //       amount: desiredAmount,
  //       season: BigNumber.from("10000")
  //     });
  //   });

  //   it("returns one full crate", async () => {
  //     const desiredAmount = sdk.tokens.BEAN.amount(200); // <= amount in first crate
  //     const pickedCrates = pickCrates(crates, desiredAmount, sdk.tokens.BEAN, 10500);

  //     expect(pickedCrates.totalAmount.eq(desiredAmount)).toBe(true);
  //     expect(pickedCrates.crates.length).toBe(1);
  //     expect(pickedCrates.crates[0]).toMatchObject({
  //       amount: desiredAmount,
  //       season: BigNumber.from("10000")
  //     });
  //   });

  //   it("returns multiple crates", async () => {
  //     const desiredAmount = sdk.tokens.BEAN.amount(701); // <= amount in first crate
  //     const pickedCrates = pickCrates(crates, desiredAmount, sdk.tokens.BEAN, 10500);

  //     expect(pickedCrates.totalAmount.eq(desiredAmount)).toBe(true);
  //     expect(pickedCrates.crates.length).toBe(3);
  //     expect(pickedCrates.crates[0]).toMatchObject({
  //       amount: sdk.tokens.BEAN.amount(200),
  //       season: BigNumber.from("10000")
  //     });
  //     expect(pickedCrates.crates[1]).toMatchObject({
  //       amount: sdk.tokens.BEAN.amount(500),
  //       season: BigNumber.from("9000")
  //     });
  //     expect(pickedCrates.crates[2]).toMatchObject({
  //       amount: sdk.tokens.BEAN.amount(1),
  //       season: BigNumber.from("8000")
  //     });
  //   });

  //   it("errors when amount is too high", async () => {
  //     const desiredAmount = sdk.tokens.BEAN.amount(10001); // <= amount in first crate

  //     const fn = () => {
  //       pickCrates(crates, desiredAmount, sdk.tokens.BEAN, 10500);
  //     };

  //     expect(fn).toThrowError("Not enough deposits");
  //   });
  // });

  describe("calculateGrownStalk via stems", () => {
    it("should call fromBlockchain with the correct arguments and return its result", () => {
      const stemTip = BigNumber.from("20");
      const stem = BigNumber.from("10");
      const bdv = sdk.tokens.BEAN.fromHuman("5");

      // Calculated as bdv.toBigNumber() * (stemTip - stem)
      // = (5e6) * (20 - 10) = 50e6
      // We typically display STALK to 10 decimals, so this is a very small amount
      const expected = sdk.tokens.STALK.fromBlockchain((50e6).toString());
      const result = calculateGrownStalkStems(stemTip, stem, bdv);

      expect(result.toBlockchain()).toBe(expected.toBlockchain());
    });
  });
});
