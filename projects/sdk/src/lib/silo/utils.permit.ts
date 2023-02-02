import { EIP712Domain, Permit } from "../permit";
import { DepositTokenPermitMessage, DepositTokensPermitMessage } from "./types";

/**
 * Get the EIP-712 domain for the Silo.
 * @note applies to both `depositToken` and `depositTokens` permits.
 */
export async function getEIP712Domain() {
  return {
    name: "SiloDeposit",
    version: "1",
    // FIXME: switch to below after protocol patch
    // chainId: (await Silo.sdk.provider.getNetwork()).chainId,
    chainId: 1,
    verifyingContract: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5"
  };
}

export const createTypedDepositTokenPermitData = (domain: EIP712Domain, message: DepositTokenPermitMessage) => ({
  types: {
    EIP712Domain: Permit.EIP712_DOMAIN,
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  },
  primaryType: "Permit",
  domain,
  message
});

export const createTypedDepositTokensPermitData = (domain: EIP712Domain, message: DepositTokensPermitMessage) => ({
  types: {
    EIP712Domain: Permit.EIP712_DOMAIN,
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "tokens", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  },
  primaryType: "Permit",
  domain,
  message
});
