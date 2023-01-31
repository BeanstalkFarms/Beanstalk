import { BigNumber } from "ethers";
import { TokenValue } from "src/TokenValue";
import { StringMap } from "src/types";

/**
 * A Crate is an `amount` of a token Deposited or
 * Withdrawn during a given `season`.
 */
type BigNumbers = TokenValue;
export type Crate<T extends BigNumbers = TokenValue> = {
  /** The amount of this Crate that was created, denominated in the underlying Token. */
  amount: T;
  /** The Season that the Crate was created. */
  season: BigNumber;
};

/**
 * A "Deposit" represents an amount of a Whitelisted Silo Token
 * that has been added to the Silo.
 */
export type DepositCrate<T extends BigNumbers = TokenValue> = Crate<T> & {
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

export type WithdrawalCrate<T extends BigNumbers = TokenValue> = Crate<T> & {};

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
    crates: DepositCrate<TokenValue>[];
  };
  withdrawn: {
    /** The total amount of this Token currently in the Withdrawn state. */
    amount: TokenValue;
    /** All Withdrawal crates. */
    crates: WithdrawalCrate<TokenValue>[];
  };
  claimable: {
    /** The total amount of this Token currently in the Claimable state. */
    amount: TokenValue;
    /** All Claimable crates. */
    crates: Crate<TokenValue>[];
  };
};

export type UpdateFarmerSiloBalancesPayload = StringMap<Partial<TokenSiloBalance>>;
