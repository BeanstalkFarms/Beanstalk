import { ethers } from "ethers";
import { TokenValue } from "src/TokenValue";
import { EIP712PermitMessage } from "src/lib/permit";

/**
 * A Deposit represents an amount of a Whitelisted Silo Token
 * that has been added to the Silo.
 */
export type Deposit = {
  /** The Season that the Crate was created. */
  stem: ethers.BigNumber;
  /** The amount of this Crate that was created, denominated in the underlying Token. */
  amount: TokenValue;
  /** The BDV of the Deposit, determined upon Deposit. */
  bdv: TokenValue;
  stalk: {
    /** The total amount of Stalk granted for this Deposit. */
    total: TokenValue;
    /** The Stalk associated with the base BDV of the Deposit. */
    base: TokenValue;
    /** The Stalk grown since the time of Deposit. */
    grown: TokenValue;
  };
  /** The amount of Seeds granted for this Deposit. */
  seeds: TokenValue;
};

/**
 * A "Silo Balance" provides all information about a Farmer's deposits of a
 * Whitelisted Silo Token.
 */
export type TokenSiloBalance = {
  /** The total amount of this Token currently in the Deposited state. */
  amount: TokenValue;
  /** The BDV of this Token currently in the Deposited state. */
  bdv: TokenValue;
  /** All Deposit crates. */
  deposits: Deposit[];
};

export type MapValueType<A> = A extends Map<any, infer V> ? V : never;

// FIXME: resolve with EIP712PermitMessage
export type DepositTokenPermitMessage = EIP712PermitMessage<{
  token: string;
  value: number | string;
}>;

export type DepositTokensPermitMessage = EIP712PermitMessage<{
  tokens: string[];
  values: (number | string)[];
}>;
