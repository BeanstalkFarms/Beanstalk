import { ContractTransaction } from "ethers";
import { WETH9, Well as WellContract } from "src/constants/generated";

export type SwapFromOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["swapFrom"]>;
};
export type SwapToOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["swapTo"]>;
};
export type ShiftOp = {
  contract: WellContract;
  method: string;
  parameters: Parameters<WellContract["shift"]>;
};
export type WrapEthOp = {
  contract: WETH9;
  method: string;
  parameters: Parameters<WETH9["deposit"]>;
};
export type UnwrapEthOp = {
  contract: WETH9;
  method: string;
  parameters: Parameters<WETH9["withdraw"]>;
};

export type Operation = SwapFromOp | ShiftOp | SwapToOp | WrapEthOp | UnwrapEthOp;

export type SingleOP = () => Promise<ContractTransaction>;
