import { BigNumber } from "ethers";
import { TokenValue } from "src/TokenValue";
import { EIP712PermitMessage } from "src/lib/permit";

type BigNumbers = TokenValue;

/**
 * A Crate identifies an `amount` of a token stored within the Silo.
 */
export type Crate<T extends BigNumbers = TokenValue> = {
  /** The Season that the Crate was created. */
  season: BigNumber;
  /** The amount of this Crate that was created, denominated in the underlying Token. */
  amount: T;
};

/**
 * A Deposit represents an amount of a Whitelisted Silo Token
 * that has been added to the Silo.
 */
export type Deposit<T extends BigNumbers = TokenValue> = Crate<T> & {
  /** The BDV of the Deposit, determined upon Deposit. */
  bdv: T;
  /** The total amount of Stalk granted for this Deposit. */
  stalk: T;
  /** The Stalk associated with the BDV of the Deposit. */
  baseStalk: T;
  /** The Stalk grown since the time of Deposit. */
  grownStalk: T;
  /** The amount of Seeds granted for this Deposit. */
  seeds: T;
};

/**
 * A "Silo Balance" provides all information
 * about a Farmer's ownership of a Whitelisted Silo Token.
 */
export type TokenSiloBalance = {
  deposited: {
    /** The total amount of this Token currently in the Deposited state. */
    amount: TokenValue;
    /** The BDV of this Token currently in the Deposited state. */
    bdv: TokenValue;
    /** All Deposit crates. */
    crates: Deposit<TokenValue>[];
  };
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
