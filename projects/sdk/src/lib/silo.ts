import { BigNumber, ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { BeanstalkSDK, DataSource } from "./BeanstalkSDK";
import { EventProcessor } from "src/lib/events/processor";
import { EIP712TypedData } from "./permit";
import * as utils from "./silo/utils";
import * as permitUtils from "./silo/utils.permit";
import { TokenValue } from "@beanstalk/sdk-core";
import { MAX_UINT256 } from "src/constants";
import { DepositBuilder } from "./silo/DepositBuilder";
import { DepositOperation } from "./silo/DepositOperation";
import { Withdraw } from "./silo/Withdraw";
import { Claim } from "./silo/Claim";
import { FarmToMode } from "./farm";
import { DepositCrate, TokenSiloBalance, DepositTokenPermitMessage, DepositTokensPermitMessage } from "./silo/types";
import { Transfer } from "./silo/Transfer";
import { Convert, ConvertDetails } from "./silo/Convert";

export class Silo {
  static sdk: BeanstalkSDK;
  private depositBuilder: DepositBuilder;
  siloWithdraw: Withdraw;
  siloClaim: Claim;
  siloTransfer: Transfer;
  siloConvert: Convert;
  // 1 Seed grows 1 / 10_000 Stalk per Season.
  // 1/10_000 = 1E-4
  // FIXME
  static STALK_PER_SEED_PER_SEASON = TokenValue.fromHuman(1e-4, 10);

  constructor(sdk: BeanstalkSDK) {
    Silo.sdk = sdk;
    this.depositBuilder = new DepositBuilder(sdk);
    this.siloWithdraw = new Withdraw(sdk);
    this.siloClaim = new Claim(sdk);
    this.siloTransfer = new Transfer(sdk);
    this.siloConvert = new Convert(sdk);
  }

  /**
   * Mowing adds Grown Stalk to stalk balance
   * @param _account
   */
  async mow(_account?: string, _token?: Token): Promise<ContractTransaction> {
    const account = _account ?? (await Silo.sdk.getAccount());
    const token = _token ?? Silo.sdk.tokens.BEAN;

    return Silo.sdk.contracts.beanstalk.mow(account, token.address);
  }

  /**
   * TODO: prevent duplicate tokens from being passed.
   */
  async mowMultiple(_account?: string, _tokens?: Token[]): Promise<ContractTransaction> {
    const account = _account ?? (await Silo.sdk.getAccount());

    let addrs: string[];
    if (_tokens) {
      if (_tokens.length === 0) throw new Error("No tokens provided");
      if (_tokens.length === 1) {
        console.warn("Optimization: use `mow()` instead of `mowMultiple()` for a single token");
      }

      const notWhitelisted = _tokens.find((token) => Silo.sdk.tokens.isWhitelisted(token) === false);
      if (notWhitelisted) throw new Error(`${notWhitelisted.symbol} is not whitelisted`);

      addrs = _tokens.map((t) => t.address);
    } else {
      // Default: all whitelisted tokens
      addrs = Silo.sdk.tokens.siloWhitelistAddresses;
    }

    return Silo.sdk.contracts.beanstalk.mowMultiple(account, addrs);
  }

  /**
   * Claims Earned Beans, Earned Stalk, Plantable Seeds and also mows any Grown Stalk
   */
  async plant(): Promise<ContractTransaction> {
    return Silo.sdk.contracts.beanstalk.plant();
  }

  /**
   * Make a deposit into a whitelisted token silo. Any supported token is allowed
   * as input and will be swaped for the desired targetToken.
   * @param inputToken The token you want to spend. It will be swaped into targetToken if needed
   * @param targetToken The whitelisted token we are _actually_ depositing
   * @param amount The amount of the inputToken to use
   * @param slippage Slipage to use if a swap is needed.
   * @param _account Address of the user
   * @returns
   */
  async deposit(
    inputToken: Token,
    targetToken: Token,
    amount: TokenValue,
    slippage: number = 0.1,
    _account?: string
  ): Promise<ContractTransaction> {
    const account = _account ?? (await Silo.sdk.getAccount(_account));
    const depositOperation = await this.buildDeposit(targetToken, account);
    depositOperation.setInputToken(inputToken);

    return depositOperation.execute(amount, slippage);
  }

  /**
   * Create a DepositOperation helper object. Using a builder/depositOperation pattern
   * is useful in UIs or scenarios where we want to reuse a pre-calculated route.
   * @param targetToken The token we want to deposit. Must be a white-listed token
   * @returns DepositOperation
   */
  buildDeposit(targetToken: Token, account: string): DepositOperation {
    return this.depositBuilder.buildDeposit(targetToken, account);
  }

  /**
   * Initates a withdraw from the silo. The `token` specified dictates which silo to withdraw
   * from, and therefore is limited to only whitelisted assets.
   * Behind the scenes, the `amount` to be withdrawn must be taken from individual
   * deposits, aka crates. A user's deposits are not summarized into one large bucket, from
   * which we can withdraw at will. Each deposit is independently tracked, so each withdraw must
   * calculate how many crates it must span to attain the desired `amount`.
   * @param token The whitelisted token to withdraw. ex, BEAN vs BEAN_3CRV_LP
   * @param amount The desired amount to withdraw. Must be 0 < amount <= total deposits for token
   * @returns Promise of Transaction
   */
  async withdraw(token: Token, amount: TokenValue): Promise<ContractTransaction> {
    return this.siloWithdraw.withdraw(token, amount);
  }

  /**
   * Initates a transfer of a token from the silo.
   * @param token The whitelisted token to withdraw. ex, BEAN vs BEAN_3CRV_LP
   * @param amount The desired amount to transfer. Must be 0 < amount <= total deposits for token
   * @param destinationAddress The destination address for the transfer
   * @returns Promise of Transaction
   */
  async transfer(token: Token, amount: TokenValue, destinationAddress: string): Promise<ContractTransaction> {
    return this.siloTransfer.transfer(token, amount, destinationAddress);
  }

  /**
   * This methods figures out which deposits, or crates, the withdraw must take from
   * in order to reach the desired amount. It returns extra information that may be useful
   * in a UI to show the user how much stalk and seed they will forfeit as a result of the withdraw
   */
  async calculateWithdraw(token: Token, amount: TokenValue, crates: DepositCrate[], season: number) {
    return this.siloWithdraw.calculateWithdraw(token, amount, crates, season);
  }

  /**
   * Returns the claimable amount for the given whitelisted token, and the underlying crates
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param dataSource Dictates where to lookup the available claimable amount, subgraph vs onchain
   */
  async getClaimableAmount(token: Token, dataSource?: DataSource) {
    return this.siloClaim.getClaimableAmount(token, dataSource);
  }

  /**
   * Claims all claimable amount of the given whitelisted token
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param dataSource Dictates where to lookup the available claimable amount, subgraph vs onchain
   * @param toMode Where to send the output tokens (circulating or farm balance)
   */
  async claim(token: Token, dataSource?: DataSource, toMode: FarmToMode = FarmToMode.EXTERNAL) {
    return this.siloClaim.claim(token, dataSource, toMode);
  }

  /**
   * Claims specific seasons from Silo claimable amount.
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param seasons Which seasons to claim, from the available claimable list. List of seasons
   * can be retrieved with .getClaimableAmount()
   * @param toMode Where to send the output tokens (circulating or farm balance)
   */
  async claimSeasons(token: Token, seasons: string[], toMode: FarmToMode = FarmToMode.EXTERNAL) {
    return this.siloClaim.claimSeasons(token, seasons, toMode);
  }

  /**
   * Convert from one Silo whitelisted token to another.
   * @param fromToken Token to convert from
   * @param toToken  Token to cnvert to
   * @param fromAmount Amount to convert
   * @returns Promise of Transaction
   */
  async convert(fromToken: Token, toToken: Token, fromAmount: TokenValue) {
    return this.siloConvert.convert(fromToken, toToken, fromAmount);
  }

  /**
   * Estimate a Silo convert() operation.
   * @param fromToken
   * @param toToken
   * @param fromAmount
   * @returns An object containing minAmountOut, which is the estimated convert amount
   * and conversion, which contains details of the convert operation. conversion property
   * would be useful in a UI
   */
  async convertEstimate(
    fromToken: Token,
    toToken: Token,
    fromAmount: TokenValue
  ): Promise<{ minAmountOut: TokenValue; conversion: ConvertDetails }> {
    return this.siloConvert.convertEstimate(fromToken, toToken, fromAmount);
  }

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

    if (!Silo.sdk.tokens.siloWhitelist.has(_token)) throw new Error(`${_token.address} is not whitelisted in the Silo`);

    /// SETUP
    const balance: TokenSiloBalance = utils.makeTokenSiloBalance();

    if (source === DataSource.LEDGER) {
      const events = await Silo.sdk.events.getSiloEvents(account, _token.address);
      const processor = new EventProcessor(Silo.sdk, account);
      const { deposits } = processor.ingestAll(events);

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
          utils.applyDeposit(balance.deposited, _token, rawCrate, currentSeason);
        }

        // NOTE: We don't load legacy Withdrawals from LEDGER, only from SUBGRAPH.

        utils.sortCrates(balance.deposited);
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
      deposited.forEach((crate) => utils.applyDeposit(balance.deposited, _token, crate, currentSeason));

      // Handle legacy withdrawals.
      withdrawn.forEach((crate) => utils.applyWithdrawal(balance.withdrawn, _token, crate));
      claimable.forEach((crate) => utils.applyWithdrawal(balance.claimable, _token, crate));

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
    whitelist.forEach((token) => balances.set(token, utils.makeTokenSiloBalance()));

    /// LEDGER
    if (source === DataSource.LEDGER) {
      const events = await Silo.sdk.events.getSiloEvents(account);
      const processor = new EventProcessor(Silo.sdk, account);
      const { deposits } = processor.ingestAll(events);

      // Handle deposits.
      // Attach stalk & seed counts for each crate.
      deposits.forEach((_crates, token) => {
        if (!balances.has(token)) {
          balances.set(token, utils.makeTokenSiloBalance());
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
          utils.applyDeposit(state, token, rawCrate, currentSeason);
        }

        utils.sortCrates(state);
      });

      // NOTE: We don't load legacy Withdrawals from LEDGER, only from SUBGRAPH.

      return utils.sortTokenMapByWhitelist(Silo.sdk.tokens.siloWhitelist, balances); // FIXME: sorting is redundant if this is instantiated
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
        if (!balances.has(token)) balances.set(token, utils.makeTokenSiloBalance());
        return token;
      };

      // Handle deposits.
      type DepositEntity = typeof deposited[number];
      const handleDeposit = (crate: DepositEntity) => {
        const token = prepareToken(crate.token);
        if (!token) return;
        const state = balances.get(token)!.deposited;
        utils.applyDeposit(state, token, crate, currentSeason);
      };

      // Handle legacy withdrawals.
      // Claimable = withdrawals from the past. The GraphQL query enforces this.
      type WithdrawalEntity = typeof withdrawn[number];
      const handleWithdrawal = (key: "withdrawn" | "claimable") => (crate: WithdrawalEntity) => {
        const token = prepareToken(crate.token);
        if (!token) return;
        const state = balances.get(token)![key];
        utils.applyWithdrawal(state, token, crate);
      };

      deposited.forEach(handleDeposit);
      withdrawn.forEach(handleWithdrawal("withdrawn"));
      claimable.forEach(handleWithdrawal("claimable"));

      return utils.sortTokenMapByWhitelist(Silo.sdk.tokens.siloWhitelist, balances);
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
    return Silo.sdk.contracts.beanstalk.balanceOfLegacySeeds(account).then((v) => Silo.sdk.tokens.SEEDS.fromBlockchain(v));
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
    throw new Error("Not implemented");
  }

  /**
   * Get a Farmer's Grown Stalk since last Mow. Aggregates Grown Stalk across
   * all whitelisted tokens.
   */
  async getGrownStalk(_account?: string) {
    const account = await Silo.sdk.getAccount(_account);

    const results = await Promise.all(
      Silo.sdk.tokens.siloWhitelistAddresses.map((address) => {
        return Silo.sdk.contracts.beanstalk.balanceOfGrownStalk(account, address);
      })
    );

    return Silo.sdk.tokens.STALK.fromBlockchain(
      results.reduce((a, b) => a.add(b), BigNumber.from(0)) // TODO: sum function?
    );
  }

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
      permitUtils.getEIP712Domain(),
      _nonce || Silo.sdk.contracts.beanstalk.depositPermitNonces(owner).then((nonce) => nonce.toString())
    ]);

    return permitUtils.createTypedDepositTokenPermitData(domain, {
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
      permitUtils.getEIP712Domain(),
      _nonce || Silo.sdk.contracts.beanstalk.depositPermitNonces(owner).then((nonce) => nonce.toString())
    ]);

    return permitUtils.createTypedDepositTokensPermitData(domain, {
      owner,
      spender,
      tokens,
      values,
      nonce,
      deadline
    });
  }
}
