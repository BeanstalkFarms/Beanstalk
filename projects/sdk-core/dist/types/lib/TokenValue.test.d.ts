import { BigNumber } from "ethers";
declare module "expect" {
    interface AsymmetricMatchers {
        toMatchTokenValue(decimals: number, humanValue: string, bigNumber?: BigNumber): void;
    }
    interface Matchers<R> {
        toMatchTokenValue(decimals: number, humanValue: string, bigNumber?: BigNumber): R;
    }
}
