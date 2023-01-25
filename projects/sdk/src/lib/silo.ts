import { ethers, BigNumber, ContractTransaction } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { StringMap } from "src/types";
import { BeanstalkSDK, DataSource } from "./BeanstalkSDK";
import EventProcessor from "./events/processor";
import { EIP712Domain, EIP712TypedData, Permit } from "./permit";
import {
  CrateSortFn,
  DepositTokenPermitMessage,
  DepositTokensPermitMessage,
  sortCratesBySeason,
  _parseWithdrawalCrates
} from "./silo.utils";
import { TokenValue } from "src/classes/TokenValue";
import { MAX_UINT256 } from "src/constants";
import { assert } from "src/utils";
import { DepositBuilder } from "./silo/DepositBuilder";
import { DepositOperation } from "./silo/DepositOperation";
import { Withdraw } from "./silo/Withdraw";

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

export class Silo {
  static sdk: BeanstalkSDK;
  private depositBuilder: DepositBuilder;
  withdraw: Withdraw;
  // 1 Seed grows 1 / 10_000 Stalk per Season.
  // 1/10_000 = 1E-4
  // FIXME
  static STALK_PER_SEED_PER_SEASON = TokenValue.fromHuman(1e-4, 10);

  constructor(sdk: BeanstalkSDK) {
    Silo.sdk = sdk;
    this.depositBuilder = new DepositBuilder(sdk);
    this.withdraw = new Withdraw(sdk);
  }

  //////////////////////// UTILITIES ////////////////////////

  /**
   * Sort the incoming map so that tokens are ordered in the same order
   * they appear on the Silo Whitelist.
   *
   * @note the Silo Whitelist is sorted by the order in which tokens were
   * whitelisted in Beanstalk. Unclear if the ordering shown on the
   * Beanstalk UI will change at some point in the future.
   */
  private _sortTokenMapByWhitelist<T extends any>(map: Map<Token, T>) {
    const whitelist = Silo.sdk.tokens.siloWhitelist;
    const copy = new Map<Token, T>(map);
    const ordered = new Map<Token, T>();
    // by default, order by whitelist
    whitelist.forEach((token) => {
      const v = copy.get(token);
      if (v) {
        ordered.set(token, v);
        copy.delete(token);
      }
    });
    // add remaining tokens
    copy.forEach((_, token) => {
      ordered.set(token, copy.get(token)!);
    });
    return ordered;
  }

  //////////////////////// WHITELIST ////////////////////////

  /**
   * Return a list of tokens that are currently whitelisted in the Silo.
   *
   * @todo Check if the subgraph removes `WhitelistToken` entities if a
   *       token is de-whitelisted.
   * @todo Get name, decimals since these are ERC20 tokens.
   */
  public async getWhitelist(options?: { source: DataSource.LEDGER } | { source: DataSource.SUBGRAPH }) {
    const source = Silo.sdk.deriveConfig("source", options);
    if (source === DataSource.SUBGRAPH) {
      const query = await Silo.sdk.queries.getSiloWhitelist();
      return query.whitelistTokens.map((e) => ({
        token: e.token,
        stalk: parseInt(e.stalk),
        seeds: parseInt(e.seeds) / 1e4
      }));
    }
    throw new Error(`Unsupported source: ${source}`);
  }

  //////////////////////// BALANCES ////////////////////////

  private _parseWithdrawalCrates = _parseWithdrawalCrates;

  private _makeTokenSiloBalance(): TokenSiloBalance {
    return {
      deposited: {
        amount: TokenValue.ZERO,
        bdv: TokenValue.ZERO,
        crates: [] as DepositCrate[]
      },
      withdrawn: {
        amount: TokenValue.ZERO,
        crates: [] as WithdrawalCrate[]
      },
      claimable: {
        amount: TokenValue.ZERO,
        crates: [] as WithdrawalCrate[]
      }
    };
  }

  /**
   * Calculate the amount Stalk grown since `depositSeason`.
   * Depends on the `currentSeason` and the `depositSeeds` awarded
   * for a particular deposit.
   *
   * @param currentSeason
   * @param depositSeason
   * @param depositSeeds
   * @returns TokenValue<STALK>
   */
  public calculateGrownStalk(currentSeason: ethers.BigNumberish, depositSeason: ethers.BigNumberish, depositSeeds: TokenValue): TokenValue {
    const deltaSeasons = ethers.BigNumber.from(currentSeason).sub(depositSeason);
    assert(deltaSeasons.gte(0), "Silo: Cannot calculate grown stalk when `currentSeason < depositSeason`.");
    return Silo.STALK_PER_SEED_PER_SEASON.mul(depositSeeds).mul(deltaSeasons.toNumber());
  }

  /**
   * Create a new Deposit Crate object.
   *
   * @param token Token contained within the crate
   * @param _season The season of deposit
   * @param _amount The amount of deposit
   * @param _bdv The bdv of deposit
   * @param currentSeason The current season, for calculation of grownStalk.
   * @returns DepositCrate<TokenValue>
   */
  public makeDepositCrate(
    token: Token,
    _season: string | number,
    _amount: string,
    _bdv: string,
    currentSeason: ethers.BigNumberish
  ): DepositCrate<TokenValue> {
    // Crate
    const season = ethers.BigNumber.from(_season);
    const amount = token.fromBlockchain(_amount);

    // Deposit-specific
    const bdv = Silo.sdk.tokens.BEAN.fromBlockchain(_bdv);
    const seeds = token.getSeeds(bdv);
    const baseStalk = token.getStalk(bdv);
    const grownStalk = this.calculateGrownStalk(currentSeason, season, seeds);
    const stalk = baseStalk.add(grownStalk);

    return {
      season,
      amount,
      bdv,
      stalk,
      baseStalk,
      grownStalk,
      seeds
    };
  }

  /**
   * Apply a Deposit to a TokenSiloBalance.
   * @note expects inputs to be stringified (no decimals).
   */
  private _applyDeposit(
    state: TokenSiloBalance["deposited"],
    token: Token,
    rawCrate: {
      season: string | number;
      amount: string;
      bdv: string;
    },
    currentSeason: ethers.BigNumberish
  ) {
    const crate = this.makeDepositCrate(token, rawCrate.season, rawCrate.amount, rawCrate.bdv, currentSeason);

    state.amount = state.amount.add(crate.amount);
    state.bdv = state.bdv.add(crate.bdv);
    state.crates.push(crate);

    return crate;
  }

  /**
   * Apply a Deposit to a TokenSiloBalance.
   *
   * @note expects inputs to be stringified (no decimals).
   */
  private _applyWithdrawal(
    state: TokenSiloBalance["withdrawn" | "claimable"],
    token: Token,
    rawCrate: {
      season: string | number;
      amount: string;
    }
  ) {
    const season = BigNumber.from(rawCrate.season);
    const amount = token.amount(rawCrate.amount);

    const crate: Crate<TokenValue> = {
      season: season,
      amount: amount
    };

    state.amount = state.amount.add(amount);
    state.crates.push(crate);

    return crate;
  }

  private _sortCrates(state: TokenSiloBalance["deposited" | "withdrawn" | "claimable"]) {
    state.crates = state.crates.sort(
      (a, b) => a.season.sub(b.season).toNumber() // sort by season asc
    );
  }

  //////////////////////// Balances & Amounts ////////////////////////

  /**
   * Return the Farmer's balance of a single whitelisted token.
   */
  public async getBalance(
    _token: Token,
    _account?: string,
    options?: { source: DataSource.LEDGER } | { source: DataSource.SUBGRAPH }
  ): Promise<TokenSiloBalance> {
    const source = Silo.sdk.deriveConfig("source", options);
    const [account, currentSeason] = await Promise.all([Silo.sdk.getAccount(_account), Silo.sdk.sun.getSeason()]);

    // FIXME: doesn't work if _token is an instance of a token created by the SDK consumer
    if (!Silo.sdk.tokens.siloWhitelist.has(_token)) throw new Error(`${_token.address} is not whitelisted in the Silo`);

    ///  SETUP
    const whitelist = Silo.sdk.tokens.siloWhitelist;
    const balance: TokenSiloBalance = this._makeTokenSiloBalance();

    if (source === DataSource.LEDGER) {
      // Fetch and process events.
      const seasonBN = BigNumber.from(currentSeason);
      const events = await Silo.sdk.events.getSiloEvents(account, _token.address);
      const processor = new EventProcessor(Silo.sdk, account, {
        season: seasonBN,
        whitelist
      });

      const { deposits, withdrawals } = processor.ingestAll(events);

      // Handle deposits
      {
        const _crates = deposits.get(_token);

        for (let s in _crates) {
          const rawCrate = {
            season: s.toString(),
            amount: _crates[s].amount.toString(),
            bdv: _crates[s].bdv.toString()
          };
          // Update the total deposited of this token
          // and return a parsed crate object
          this._applyDeposit(balance.deposited, _token, rawCrate, currentSeason);
        }

        this._sortCrates(balance.deposited);
      }

      // Handle withdrawals
      {
        const _crates = withdrawals.get(_token);
        if (_crates) {
          const { withdrawn, claimable } = this._parseWithdrawalCrates(_token, _crates, seasonBN);

          balance.withdrawn = withdrawn;
          balance.claimable = claimable;

          this._sortCrates(balance.withdrawn);
          this._sortCrates(balance.claimable);
        }
      }

      return balance;
    }

    /// SUBGRAPH
    else if (source === DataSource.SUBGRAPH) {
      const query = await Silo.sdk.queries.getSiloBalance({
        token: _token.address.toLowerCase(),
        account,
        season: currentSeason
      }); // crates ordered in asc order
      if (!query.farmer) return balance;

      const { deposited, withdrawn, claimable } = query.farmer!;
      deposited.forEach((crate) => this._applyDeposit(balance.deposited, _token, crate, currentSeason));
      withdrawn.forEach((crate) => this._applyWithdrawal(balance.withdrawn, _token, crate));
      claimable.forEach((crate) => this._applyWithdrawal(balance.claimable, _token, crate));

      return balance;
    }

    throw new Error(`Unsupported source: ${source}`);
  }

  /**
   * Return a Farmer's Silo balances.
   *
   * ```
   * [Token] => {
   *   deposited => { amount, bdv, crates },
   *   withdrawn => { amount, crates },
   *   claimable => { amount, crates }
   * }
   * ```
   *
   * @note EventProcessor requires a known whitelist and returns
   *       an object (possibly empty) for every whitelisted token.
   * @note To process a Deposit, we must know how many Stalk & Seeds
   *       are given to it. If a token is dewhitelisted and removed from
   *       `tokens` (or from the on-chain whitelist)
   * @fixme "deposits" vs "deposited"
   */
  public async getBalances(
    _account?: string,
    options?: { source: DataSource.LEDGER } | { source: DataSource.SUBGRAPH }
  ): Promise<Map<Token, TokenSiloBalance>> {
    const source = Silo.sdk.deriveConfig("source", options);
    const [account, currentSeason] = await Promise.all([Silo.sdk.getAccount(_account), Silo.sdk.sun.getSeason()]);

    /// SETUP
    const whitelist = Silo.sdk.tokens.siloWhitelist;
    const balances = new Map<Token, TokenSiloBalance>();
    whitelist.forEach((token) => balances.set(token, this._makeTokenSiloBalance()));

    /// LEDGER
    if (source === DataSource.LEDGER) {
      // Fetch and process events.
      const seasonBN = BigNumber.from(currentSeason); // FIXME
      const events = await Silo.sdk.events.getSiloEvents(account);
      const processor = new EventProcessor(Silo.sdk, account, {
        season: seasonBN,
        whitelist
      });
      const { deposits, withdrawals } = processor.ingestAll(events);

      // Handle deposits.
      // Attach stalk & seed counts for each crate.
      deposits.forEach((_crates, token) => {
        if (!balances.has(token)) {
          balances.set(token, this._makeTokenSiloBalance());
        }
        const state = balances.get(token)!.deposited;

        for (let s in _crates) {
          const rawCrate = {
            season: s.toString(),
            amount: _crates[s].amount.toString(),
            bdv: _crates[s].bdv.toString()
          };

          // Update the total deposited of this token
          // and return a parsed crate object
          this._applyDeposit(state, token, rawCrate, currentSeason);
        }

        this._sortCrates(state);
      });

      // Handle withdrawals.
      // Split crates into withdrawn and claimable.
      withdrawals.forEach((_crates, token) => {
        if (!balances.has(token)) {
          balances.set(token, this._makeTokenSiloBalance());
        }

        //
        const { withdrawn, claimable } = this._parseWithdrawalCrates(token, _crates, seasonBN);
        const tokenBalance = balances.get(token);
        tokenBalance!.withdrawn = withdrawn;
        tokenBalance!.claimable = claimable;

        this._sortCrates(tokenBalance!.withdrawn);
        this._sortCrates(tokenBalance!.claimable);
      });

      return this._sortTokenMapByWhitelist(balances); // FIXME: sorting is redundant if this is instantiated
    }

    /// SUBGRAPH
    if (source === DataSource.SUBGRAPH) {
      const query = await Silo.sdk.queries.getSiloBalances({ account, season: currentSeason }); // crates ordered in asc order
      if (!query.farmer) return balances;
      const { deposited, withdrawn, claimable } = query.farmer!;

      // Lookup token by address and create a TokenSiloBalance entity.
      // @fixme private member of Silo?
      const prepareToken = (address: string) => {
        const token = Silo.sdk.tokens.findByAddress(address);
        if (!token) return; // FIXME: unknown token handling
        if (!balances.has(token)) balances.set(token, this._makeTokenSiloBalance());
        return token;
      };

      // Handle deposits.
      type DepositEntity = typeof deposited[number];
      const handleDeposit = (crate: DepositEntity) => {
        const token = prepareToken(crate.token);
        if (!token) return;
        const state = balances.get(token)!.deposited;
        this._applyDeposit(state, token, crate, currentSeason);
      };

      // Handle withdrawals.
      // Claimable = withdrawals from the past. The GraphQL query enforces this.
      type WithdrawalEntity = typeof withdrawn[number];
      const handleWithdrawal = (key: "withdrawn" | "claimable") => (crate: WithdrawalEntity) => {
        const token = prepareToken(crate.token);
        if (!token) return;
        const state = balances.get(token)![key];
        this._applyWithdrawal(state, token, crate);
      };

      deposited.forEach(handleDeposit);
      withdrawn.forEach(handleWithdrawal("withdrawn"));
      claimable.forEach(handleWithdrawal("claimable"));

      return this._sortTokenMapByWhitelist(balances);
    }

    throw new Error(`Unsupported source: ${source}`);
  }

  /**
   * Get a Farmer's stalk, grown stalk, earned stalk.
   * Does NOT currently include revitalized stalk
   */
  async getAllStalk(_account?: string) {
    const [active, earned, grown] = await Promise.all([
      this.getStalk(_account),
      this.getEarnedStalk(_account),
      this.getGrownStalk(_account)
    ]);
    // TODO: add revitalized
    return {
      active,
      earned,
      grown
    };
  }

  /**
   * Get a Farmer's current Stalk. This already includes Earned Stalk
   * @param _account
   * @returns
   */
  async getStalk(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    return Silo.sdk.contracts.beanstalk.balanceOfStalk(account).then((v) => Silo.sdk.tokens.STALK.fromBlockchain(v));
  }

  /**
   * Get a Farmer's current Seeds. Does not include Plantable or Revitalized Seeds
   * @param _account
   * @returns
   */
  async getSeeds(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    return Silo.sdk.contracts.beanstalk.balanceOfSeeds(account).then((v) => Silo.sdk.tokens.SEEDS.fromBlockchain(v));
  }

  /**
   * Get a Farmer's Earned Beans since last Plant.
   *
   * @param _account
   * @returns
   */
  async getEarnedBeans(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    return Silo.sdk.contracts.beanstalk.balanceOfEarnedBeans(account).then((v) => Silo.sdk.tokens.BEAN.fromBlockchain(v));
  }

  /**
   * Get a Farmer's Earned Stalk since last Plant. This is already included in getStalk() balance
   */
  async getEarnedStalk(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    return Silo.sdk.contracts.beanstalk.balanceOfEarnedStalk(account).then((v) => Silo.sdk.tokens.STALK.fromBlockchain(v));
  }

  /**
   * Get a Farmer's Plantable Seeds since last Plant. These are seeds earned from current Earned Stalk.
   * @param _account
   * @returns
   */
  async getPlantableSeeds(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    // TODO: this is wrong
    return Silo.sdk.contracts.beanstalk.balanceOfEarnedSeeds(account).then((v) => Silo.sdk.tokens.SEEDS.fromBlockchain(v));
  }

  /**
   * Get a Farmer's Grown Stalk since last Mow.
   * @param _account
   * @returns
   */
  async getGrownStalk(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);
    return Silo.sdk.contracts.beanstalk.balanceOfGrownStalk(account).then((v) => Silo.sdk.tokens.STALK.fromBlockchain(v));
  }

  //////////////////////// Crates ////////////////////////

  pickCrates(
    crates: Crate<TokenValue>[],
    token: Token,
    amount: BigNumber | TokenValue,
    sort: CrateSortFn = (crates) => sortCratesBySeason(crates, "desc")
  ) {
    const sortedCrates = sort(crates);
    const seasons: string[] = [];
    const amounts: string[] = [];
    let remaining = amount instanceof TokenValue ? TokenValue.from(amount) : TokenValue.fromBlockchain(amount, token.decimals);
    sortedCrates.some((crate) => {
      const thisAmount = crate.amount.gt(remaining) ? crate.amount.sub(remaining) : crate.amount;
      seasons.push(crate.season.toString());
      amounts.push(thisAmount.toBlockchain());
      remaining = remaining.sub(thisAmount);
      return remaining.eq(0); // done
    });
    if (!remaining.eq(0)) throw new Error("Not enough amount in crates");
    return { seasons, amounts };
  }

  sumDeposits(token: ERC20Token, crates: DepositCrate[]) {
    return crates.reduce(
      (prev, curr) => {
        prev.amount = prev.amount.add(curr.amount);
        prev.stalk = prev.stalk.add(curr.stalk);
        prev.seeds = prev.seeds.add(curr.seeds);
        prev.bdv = prev.bdv.add(curr.bdv);
        return prev;
      },
      {
        amount: token.amount(0),
        stalk: Silo.sdk.tokens.STALK.amount(0),
        seeds: Silo.sdk.tokens.SEEDS.amount(0),
        bdv: Silo.sdk.tokens.BEAN.amount(0)
      }
    );
  }

  async bdv(_token: Token, _amount?: TokenValue) {
    return Silo.sdk.contracts.beanstalk
      .bdv(_token.address, (_amount || _token.amount(1)).toBlockchain())
      .then((v) => Silo.sdk.tokens.BEAN.fromBlockchain(v));
  }

  //////////////////////// ACTION: Deposit ////////////////////////

  // public deposit = wrapped(Silo.sdk.contracts.beanstalk, 'deposit')
  // $deposit = Silo.sdk.contracts.beanstalk.deposit;
  // $plant = Silo.sdk.contracts.beanstalk.plant;
  // $update = Silo.sdk.contracts.beanstalk.update;
  // $lastUpdate = Silo.sdk.contracts.beanstalk.lastUpdate;

  /**
   * Create a DepositOperation helper object
   * @param targetToken The token we want to deposit. Must be a white-listed token
   * @returns DepositOperation
   */
  buildDeposit(targetToken: Token, account: string): DepositOperation {
    return this.depositBuilder.buildDeposit(targetToken, account);
  }

  //////////////////////// ACTION: Claim Rewards ////////////////////////
  /**
   * Mowing adds Grown Stalk to stalk balance
   * @param _account
   */
  async mow(_account?: string): Promise<ContractTransaction> {
    const account = _account ? _account : await Silo.sdk.getAccount();
    return Silo.sdk.contracts.beanstalk.update(account);
  }

  /**
   * Claims Earned Beans, Earned Stalk, Plantable Seeds and also mows any Grown Stalk
   */
  async plant(): Promise<ContractTransaction> {
    return Silo.sdk.contracts.beanstalk.plant();
  }

  //////////////////////// Permits ////////////////////////

  /**
   * Created typed permit data to authorize `spender` to transfer
   * the `owner`'s deposit balance of `token`.
   *
   * @fixme `permitDepositToken` -> `getPermitForToken`
   *
   * @param owner the Farmer whose Silo deposit can be transferred
   * @param spender the account authorized to make a transfer
   * @param token the whitelisted token that can be transferred
   * @param value the amount of the token that can be transferred
   * @param _nonce a nonce to include when signing permit.
   * Defaults to `beanstalk.depositPermitNonces(owner)`.
   * @param _deadline the permit deadline.
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @returns typed permit data. This can be signed with `sdk.permit.sign()`.
   */
  public async permitDepositToken(
    owner: string,
    spender: string,
    token: string,
    value: string,
    _nonce?: string,
    _deadline?: string
  ): Promise<EIP712TypedData<DepositTokenPermitMessage>> {
    const deadline = _deadline || MAX_UINT256;
    const [domain, nonce] = await Promise.all([
      this._getEIP712Domain(),
      _nonce || Silo.sdk.contracts.beanstalk.depositPermitNonces(owner).then((nonce) => nonce.toString())
    ]);

    return this._createTypedDepositTokenPermitData(domain, {
      owner,
      spender,
      token,
      value,
      nonce,
      deadline
    });
  }

  /**
   * Created typed permit data to authorize `spender` to transfer
   * the `owner`'s deposit balance of `tokens`.
   *
   * @fixme `permitDepositTokens` -> `getPermitForTokens`
   *
   * @param owner the Farmer whose Silo deposit can be transferred
   * @param spender the account authorized to make a transfer
   * @param tokens the whitelisted tokens that can be transferred.
   * @param values the amount of each token in `tokens` that can be transferred.
   * `values[0]` = how much of `tokens[0]` can be transferred, etc.
   * @param _nonce a nonce to include when signing permit.
   * Defaults to `beanstalk.depositPermitNonces(owner)`.
   * @param _deadline the permit deadline.
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @returns typed permit data. This can be signed with `sdk.permit.sign()`.
   */
  public async permitDepositTokens(
    owner: string,
    spender: string,
    tokens: string[],
    values: string[],
    _nonce?: string,
    _deadline?: string
  ): Promise<EIP712TypedData<DepositTokensPermitMessage>> {
    if (tokens.length !== values.length) throw new Error("Input mismatch: number of tokens does not equal number of values");
    if (tokens.length === 1) console.warn("Optimization: use permitDepositToken when permitting one Silo Token.");

    const deadline = _deadline || MAX_UINT256;
    const [domain, nonce] = await Promise.all([
      this._getEIP712Domain(),
      _nonce || Silo.sdk.contracts.beanstalk.depositPermitNonces(owner).then((nonce) => nonce.toString())
    ]);

    return this._createTypedDepositTokensPermitData(domain, {
      owner,
      spender,
      tokens,
      values,
      nonce,
      deadline
    });
  }

  /**
   * Get the EIP-712 domain for the Silo.
   * @note applies to both `depositToken` and `depositTokens` permits.
   */
  private async _getEIP712Domain() {
    return {
      name: "SiloDeposit",
      version: "1",
      // FIXME: switch to below after protocol patch
      // chainId: (await Silo.sdk.provider.getNetwork()).chainId,
      chainId: 1,
      verifyingContract: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5"
    };
  }

  private _createTypedDepositTokenPermitData = (domain: EIP712Domain, message: DepositTokenPermitMessage) => ({
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

  private _createTypedDepositTokensPermitData = (domain: EIP712Domain, message: DepositTokensPermitMessage) => ({
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
}
