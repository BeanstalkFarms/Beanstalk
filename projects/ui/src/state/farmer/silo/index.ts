import BigNumberJS from 'bignumber.js';
import { TokenMap } from '~/constants';

/**
 * A Crate is an `amount` of a token Deposited or
 * Withdrawn during a given `season`.
 */
export type Crate = {
  /** The amount of this Crate that was created, denominated in the underlying Token. */
  amount: BigNumberJS;
  /** The Season that the Crate was created. */
  season: BigNumberJS;
};

/**
 * A "Deposit" represents an amount of a Whitelisted Silo Token
 * that has been added to the Silo.
 */
export type DepositCrate = Crate & {
  /** The BDV of the Deposit, determined upon Deposit. */
  bdv: BigNumberJS;
  /** The amount of Stalk granted for this Deposit. */
  stalk: BigNumberJS;
  /** The amount of Seeds granted for this Deposit. */
  seeds: BigNumberJS;
};

/**
 * A "Withdrawal" represents an amount of a "Deposit"
 * that was removed from the Silo. Withdrawals remain pending
 * for several seasons until they are ready to be Claimed.
 */
export type WithdrawalCrate = Crate & {};

/**
 * A "Silo Balance" provides all information
 * about a Farmer's ownership of a Whitelisted Silo Token.
 */
export type FarmerSiloBalance = {
  /** Season in which the farmer last updated their Silo */
  lastUpdate: BigNumberJS;
  deposited: {
    /** The total amount of this Token currently in the Deposited state. */
    amount: BigNumberJS;
    /** The BDV of this Token currently in the Deposited state. */
    bdv: BigNumberJS;
    /** All Deposit crates. */
    crates: DepositCrate[];
  };
  withdrawn: {
    /** The total amount of this Token currently in the Withdrawn state. */
    amount: BigNumberJS;
    /** */
    bdv: BigNumberJS;
    /** All Withdrawal crates. */
    crates: WithdrawalCrate[];
  };
  claimable: {
    /** The total amount of this Token currently in the Claimable state. */
    amount: BigNumberJS;
    /** All Claimable crates. */
    crates: Crate[];
  };
  wrapped: BigNumberJS;
  circulating: BigNumberJS;
};

/**
 * "Silo Balances" track the detailed balances of
 * all whitelisted Silo tokens, including the amount
 * of each token deposited, claimable, withdrawn, and circulating.
 *
 * FIXME: enforce that `address` is a key of whitelisted tokens?
 */
export type FarmerSiloBalances = {
  balances: TokenMap<FarmerSiloBalance>;
};

/**
 * "Silo Rewards" are rewards earned for
 * holding tokens in the Silo.
 */
export type FarmerSiloRewards = {
  beans: {
    /**
     * The amount of Beans the Farmer has earned
     * from their ownership of the Silo.
     */
    earned: BigNumberJS;
  };
  stalk: {
    /**
     * The total amount of Stalk associated with the Farmer.
     *
     * `total = active + grown`
     */
    total: BigNumberJS;
    /**
     * In the case of stalk, ACTIVE includes EARNED.
     */
    active: BigNumberJS;
    /**
     * Earned Stalk are Stalk granted upon reception of earned
     * Beans (since 1 Deposited Bean = 1 Stalk).
     * Earned Stalk are also "active" because it increases
     * the Farmer's relative ownership in the Silo.
     */
    earned: BigNumberJS;
    /**
     * Grown Stalk is Stalk granted each Season from Seeds.
     */
    grown: BigNumberJS;
  };
  seeds: {
    /**
     * The total amount of Seeds associated with the Farmer.
     *
     * `total = active`.
     */
    total: BigNumberJS;
    /**
     *
     */
    active: BigNumberJS;
    /**
     * Plantable Seeds are Seeds granted upon reception of
     * earned Beans (since 1 Deposited Bean = 2 Stalk).
     */
    earned: BigNumberJS;
  };
  roots: {
    total: BigNumberJS;
  };
};

export type FarmerSilo = FarmerSiloBalances &
  FarmerSiloRewards & {
    migrationNeeded: boolean | undefined;
  };
