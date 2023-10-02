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
import { Deposit, TokenSiloBalance, DepositTokenPermitMessage, DepositTokensPermitMessage } from "./silo/types";
import { Transfer } from "./silo/Transfer";
import { Convert, ConvertDetails } from "./silo/Convert";

export class Silo {
  static sdk: BeanstalkSDK;
  private depositBuilder: DepositBuilder;
  siloWithdraw: Withdraw;
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
    this.siloTransfer = new Transfer(sdk);
    this.siloConvert = new Convert(sdk);
  }

  public calculateGrownStalk = utils.calculateGrownStalkStems;
  public calculateGrownStalkSeeds = utils.calculateGrownStalkSeeds;

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
  async calculateWithdraw(token: Token, amount: TokenValue, crates: Deposit[], season: number) {
    return this.siloWithdraw.calculateWithdraw(token, amount, crates, season);
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
    const [account, currentSeason, stemTip] = await Promise.all([
      Silo.sdk.getAccount(_account),
      Silo.sdk.sun.getSeason(),
      this.getStemTip(_token)
    ]);

    if (!Silo.sdk.tokens.siloWhitelist.has(_token)) throw new Error(`${_token.address} is not whitelisted in the Silo`);

    /// SETUP
    const balance: TokenSiloBalance = utils.makeTokenSiloBalance();

    /// LEDGER
    if (source === DataSource.LEDGER) {
      const events = await Silo.sdk.events.get("silo", [account, { token: _token }]);
      const processor = new EventProcessor(Silo.sdk, account);
      const { deposits: depositsByToken } = processor.ingestAll(events);

      // The processor's return schema assumes we might have wanted to grab
      // multiple tokens, so we have to grab the one we want
      const deposits = depositsByToken.get(_token);

      for (let stem in deposits) {
        utils.applyDeposit(balance, _token, stemTip, {
          stem,
          amount: deposits[stem].amount,
          bdv: deposits[stem].bdv
        });
      }

      utils.sortCrates(balance);
      return balance;
    }

    /// SUBGRAPH
    else if (source === DataSource.SUBGRAPH) {
      // Deposits are automatically sorted in ascending order
      const query = await Silo.sdk.queries.getSiloBalance({
        token: _token.address.toLowerCase(),
        account,
        // FIXME: remove season in favor of stem tip?
        season: currentSeason
      });

      if (!query.farmer) return balance;
      const { deposited } = query.farmer;

      deposited.forEach((deposit) =>
        utils.applyDeposit(balance, _token, stemTip, {
          stem: deposit.season, // FIXME
          amount: deposit.amount,
          bdv: deposit.bdv
        })
      );

      return balance;
    }

    throw new Error(`Unsupported source: ${source}`);
  }

  /**
   * Return a Farmer's Silo balances.
   *
   * ```
   * [Token] => {
   *   amount,
   *   bdv,
   *   deposits
   * }
   * ```
   */
  public async getBalances(
    _account?: string,
    options?: { source: DataSource.LEDGER } | { source: DataSource.SUBGRAPH }
  ): Promise<Map<Token, TokenSiloBalance>> {
    const source = Silo.sdk.deriveConfig("source", options);
    const [account, currentSeason, stemTips] = await Promise.all([
      Silo.sdk.getAccount(_account),
      Silo.sdk.sun.getSeason(),
      this.getStemTips([...Silo.sdk.tokens.siloWhitelist])
    ]);

    /// SETUP
    const whitelist = Silo.sdk.tokens.siloWhitelist;
    const balances = new Map<Token, TokenSiloBalance>();
    whitelist.forEach((token) => balances.set(token, utils.makeTokenSiloBalance()));

    /// LEDGER
    if (source === DataSource.LEDGER) {
      const events = await Silo.sdk.events.get("silo", [account]);
      const processor = new EventProcessor(Silo.sdk, account);
      const { deposits: depositsByToken } = processor.ingestAll(events);

      // Handle deposits.
      // Attach stalk & seed counts for each crate.
      depositsByToken.forEach((deposits, token) => {
        // If we receive a token that wasn't on the SDK's known whitelist, create
        // a new balance object for it. (This shouldn't happen)
        if (!balances.has(token)) balances.set(token, utils.makeTokenSiloBalance());
        const balance = balances.get(token)!;

        // Load stem tip, used to calculate the amount of grown stalk
        const stemTip = stemTips.get(token.address);
        if (!stemTip) throw new Error(`No stem tip found for ${token.address}`);

        for (let stem in deposits) {
          utils.applyDeposit(balance, token, stemTip, {
            stem,
            amount: deposits[stem].amount,
            bdv: deposits[stem].bdv
          });
        }

        utils.sortCrates(balance);
      });

      // FIXME: sorting is redundant if this is instantiated
      return utils.sortTokenMapByWhitelist(Silo.sdk.tokens.siloWhitelist, balances);
    }

    /// SUBGRAPH
    if (source === DataSource.SUBGRAPH) {
      // Deposits are automatically sorted in ascending order
      const query = await Silo.sdk.queries.getSiloBalances({
        account,
        season: currentSeason
      });

      if (!query.farmer) return balances;
      const { deposited } = query.farmer;

      // Handle deposits.
      deposited.forEach((deposit: typeof deposited[number]) => {
        const token = Silo.sdk.tokens.findByAddress(deposit.token);
        if (!token) return; // FIXME: unknown token handling

        // If we receive a token that wasn't on the SDK's known whitelist, create
        // a new balance object for it. (This shouldn't happen)
        if (!balances.has(token)) balances.set(token, utils.makeTokenSiloBalance());
        const balance = balances.get(token)!;

        // Load stem tip, used to calculate the amount of grown stalk
        const stemTip = stemTips.get(token.address);
        if (!stemTip) throw new Error(`No stem tip found for ${token.address}`);

        utils.applyDeposit(balance, token, stemTip, {
          stem: deposit.stem || deposit.season,
          amount: deposit.amount,
          bdv: deposit.bdv
        });
      });

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
   * TODO: Cache stemStartSeason and calculate tip using Season?
   * TODO: TokenValue?
   * TODO: Check if whitelisted?
   */
  async getStemTip(token: Token): Promise<BigNumber> {
    return Silo.sdk.contracts.beanstalk.stemTipForToken(token.address);
  }

  /**
   * TODO: Cache stemStartSeason and calculate tip using Season?
   * TODO: multicall?
   * TODO: Check if whitelisted?
   */
  async getStemTips(tokens: Token[]) {
    return Promise.all(tokens.map((token) => this.getStemTip(token).then((tip) => [token.address, tip] as const))).then(
      (tips) => new Map<String, BigNumber>(tips)
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
