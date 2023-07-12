import { ethers } from "ethers";
import { TokenValue } from "src/TokenValue";
import { EIP712PermitMessage } from "src/lib/permit";

/**
 * A Deposit represents an amount of a Whitelisted Silo Token
 * that has been added to the Silo.
 */
export type Deposit<T extends any = TokenValue> = {
  /** The Stem is the ID of the deposit. */
  stem: ethers.BigNumber;
  /** */
  // season: ethers.BigNumber | undefined;
  /** The amount of this Deposit that was created, denominated in the underlying Token. */
  amount: T;
  /** The BDV of the Deposit, determined upon Deposit. */
  bdv: T;
  stalk: {
    /** The total amount of Stalk granted for this Deposit. */
    total: T;
    /** The Stalk associated with the base BDV of the Deposit. */
    base: T;
    /** The Stalk grown since the time of Deposit. */
    grown: T;
  };
  /** The amount of Seeds granted for this Deposit. */
  seeds: T;
};

/**
 * A "Silo Balance" provides all information about a Farmer's deposits of a
 * Whitelisted Silo Token.
 */
export type TokenSiloBalance<T extends any = TokenValue> = {
  /** The total amount of this Token currently in the Deposited state. */
  amount: T;
  /** The BDV of this Token currently in the Deposited state. */
  bdv: T;
  /** All Deposit crates. */
  deposits: Deposit<T>[];
};

// FIXME: resolve with EIP712PermitMessage
export type DepositTokenPermitMessage = EIP712PermitMessage<{
  token: string;
  value: number | string;
}>;

export type DepositTokensPermitMessage = EIP712PermitMessage<{
  tokens: string[];
  values: (number | string)[];
}>;
