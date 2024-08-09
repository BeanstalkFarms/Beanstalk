import { Well, WellFunction } from "@beanstalk/sdk-wells";
import { CONSTANT_PRODUCT_2_ADDRESS, CONSTANT_PRODUCT_2_V2_ADDRESS } from "src/utils/addresses";

const cp2Addresses = [CONSTANT_PRODUCT_2_V2_ADDRESS, CONSTANT_PRODUCT_2_ADDRESS];

export const isConstantProduct2 = (param: Well | WellFunction | undefined | null) => {
  if (!param) return false;

  if (param instanceof Well) {
    const wf = param.wellFunction?.address;
    return Boolean(wf && cp2Addresses.includes(wf.toLowerCase()));
  }

  return cp2Addresses.includes(param.address.toLowerCase());
};
