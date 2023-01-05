import { ethers } from "ethers";
import { getTestUtils } from "src/utils/TestUtils/provider";

const { sdk } = getTestUtils();

const a = ethers.BigNumber.from("100");
const b = ethers.BigNumber.from("50");
const c = ethers.BigNumber.from("10");

describe("addition", () => {
  it("add", async () => {
    const a_add_b = await sdk.contracts.math.add(a, b);
    expect(a_add_b.toString()).toBe("150");
  });
});

describe("subtraction", () => {
  it("sub", async () => {
    const a_sub_b = await sdk.contracts.math.sub(a, b);
    expect(a_sub_b.toString()).toBe("50");
  });
});

describe("division", () => {
  it("div", async () => {
    const a_div_b = await sdk.contracts.math.div(a, b);
    const b_div_a = await sdk.contracts.math.div(b, a);
    expect(a_div_b.toString()).toBe("2"); // 100 / 50
    expect(b_div_a.toString()).toBe("0"); // 50 / 100
  });
});

describe("multiplication", () => {
  it("mul", async () => {
    const a_mul_b = await sdk.contracts.math.mul(a, b);
    const b_mul_a = await sdk.contracts.math.mul(b, a);
    expect(a_mul_b.toString()).toBe("5000"); // 100 * 50
    expect(b_mul_a.toString()).toBe("5000"); // 50 * 100
  });
});

describe("multiply then divide", () => {
  it("mulDiv", async () => {
    const a_mul_b_div_c = await sdk.contracts.math.mulDiv(a, b, c);
    expect(a_mul_b_div_c.toString()).toBe("500");
  });
});
