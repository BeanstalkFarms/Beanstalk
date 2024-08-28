import { BigNumber, ethers } from "ethers";
import { ERC20Token, Token } from "src/classes/Token";
import { BeanstalkSDK, DataSource } from "src/lib/BeanstalkSDK";
import { TokenSiloBalance } from "src/lib/silo/types";
import { makeDepositObject } from "src/lib/silo/utils";
import { TokenValue } from "src/TokenValue";
import * as addr from "./addresses";
import { logSiloBalance } from "./log";

export class BlockchainUtils {
  sdk: BeanstalkSDK;
  provider: ethers.providers.JsonRpcProvider;

  constructor(sdk: BeanstalkSDK) {
    this.sdk = sdk;
    this.provider = sdk.provider as ethers.providers.JsonRpcProvider; // fixme
  }

  /**
   * Snapshot the state of the blockchain at the current block
   */
  async snapshot() {
    const id = await this.provider.send("evm_snapshot", []);
    console.log("Created snapshot: ", id);
    return id;
  }

  /**
   * Revert the state of the blockchain to a previous snapshot.
   * Takes a single parameter, which is the snapshot id to revert to
   */
  async revert(id: number) {
    await this.provider.send("evm_revert", [id]);
  }

  /**
   * Send a deposit from the BF Multisig -> `to`
   */
  async sendDeposit(
    to: string,
    from: string = addr.BF_MULTISIG,
    token: ERC20Token = this.sdk.tokens.BEAN
  ): Promise<TokenSiloBalance["deposits"][number]> {
    await this.provider.send("anvil_impersonateAccount", [from]);

    const balance = await this.sdk.silo.getBalance(token, from, { source: DataSource.LEDGER });
    const crate = balance.deposits[balance.deposits.length - 1];
    const season = crate.stem.toString();
    const amount = crate.amount.toBlockchain();

    logSiloBalance(from, balance);
    console.log(`Transferring ${crate.amount.toHuman()} ${token.symbol} to ${to}...`, {
      season,
      amount
    });

    const txn = await this.sdk.contracts.beanstalk
      .connect(await this.provider.getSigner(from))
      .transferDeposit(from, to, token.address, season, amount);

    await txn.wait();
    await this.provider.send("anvil_stopImpersonatingAccount", [from]);
    console.log(`Transferred!`);

    return crate;
  }

  /**
   * Send BEAN from the BF Multisig -> `to`.
   */
  async sendBean(
    to: string,
    amount: TokenValue,
    from: string = addr.BF_MULTISIG,
    token: ERC20Token = this.sdk.tokens.BEAN
  ) {
    console.log(`Sending ${amount.toHuman()} BEAN from ${from} -> ${to}...`);

    await this.provider.send("anvil_impersonateAccount", [from]);
    const contract = token.getContract().connect(await this.provider.getSigner(from));
    await contract.transfer(to, amount.toBlockchain()).then((r) => r.wait());
    await this.provider.send("anvil_stopImpersonatingAccount", [from]);

    console.log(`Sent!`);
  }

  async resetFork() {
    await this.sdk.provider.send("anvil_reset", [
      {
        forking: {
          jsonRpcUrl: "https://eth-mainnet.g.alchemy.com/v2/f6piiDvMBMGRYvCOwLJFMD7cUjIvI1TP"
        }
      }
    ]);
  }

  async mine() {
    await this.sdk.provider.send("evm_mine", []); // Just mines to the next block
  }

  async getCurrentBlockNumber() {
    const { number } = await this.sdk.provider.send("eth_getBlockByNumber", ["latest", false]);
    return BigNumber.from(number).toNumber();
  }

  async impersonate(account: string) {
    await this.provider.send("anvil_impersonateAccount", [account]);
    return () => this.stopImpersonating(account);
  }

  async stopImpersonating(account: string) {
    await this.provider.send("anvil_stopImpersonatingAccount", [account]);
  }

  /**
   * To add more erc20 tokens later, you need the slot number. Get it with this:
   * npx slot20 balanceOf TOKENADDRESS RANDOM_HOLDER_ADDRESS -v
   * npx slot20 balanceOf 0x77700005BEA4DE0A78b956517f099260C2CA9a26 0x735cab9b02fd153174763958ffb4e0a971dd7f29 -v --rpc $RPC
   * set reverse to true if mapping format is (slot, key)
   *
   * From this article: https://kndrck.co/posts/local_erc20_bal_mani_w_hh/
   *
   * @param account
   * @param balance
   */
  async setAllBalances(account: string, amount: string) {
    await Promise.allSettled([
      this.setETHBalance(account, this.sdk.tokens.ETH.amount(amount)),
      this.setDAIBalance(account, this.sdk.tokens.DAI.amount(amount)),
      this.setUSDCBalance(account, this.sdk.tokens.USDC.amount(amount)),
      this.setUSDTBalance(account, this.sdk.tokens.USDT.amount(amount)),
      this.setWETHBalance(account, this.sdk.tokens.WETH.amount(amount)),
      this.setBEANBalance(account, this.sdk.tokens.BEAN.amount(amount)),
      this.setWSTETHBalance(account, this.sdk.tokens.WSTETH.amount(amount)),
      this.seturBEANBalance(account, this.sdk.tokens.UNRIPE_BEAN.amount(amount)),
      this.seturBEANWSTETHBalance(account, this.sdk.tokens.UNRIPE_BEAN_WSTETH.amount(amount)),
      this.setBEANWETHBalance(account, this.sdk.tokens.BEAN_ETH_WELL_LP.amount(amount)),
      this.setBEANWSTETHBalance(account, this.sdk.tokens.BEAN_WSTETH_WELL_LP.amount(amount))
    ]);
  }
  async setETHBalance(account: string, balance: TokenValue) {
    await this.sdk.provider.send("hardhat_setBalance", [account, balance.toHex()]);
  }
  async setDAIBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.DAI, account, balance);
  }
  async setUSDCBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.USDC, account, balance);
  }
  async setUSDTBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.USDT, account, balance);
  }
  async setWETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.WETH, account, balance);
  }
  async setBEANBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.BEAN, account, balance);
  }
  async seturBEANBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.UNRIPE_BEAN, account, balance);
  }
  async seturBEANWSTETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.UNRIPE_BEAN_WSTETH, account, balance);
  }
  async setBEANWETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.BEAN_ETH_WELL_LP, account, balance);
  }
  async setBEANWSTETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.BEAN_WSTETH_WELL_LP, account, balance);
  }
  async setWSTETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.WSTETH, account, balance);
  }

  private getBalanceConfig(tokenAddress: string) {
    const slotConfig = new Map();
    slotConfig.set(this.sdk.tokens.DAI.address, [2, false]);
    slotConfig.set(this.sdk.tokens.USDC.address, [9, false]);
    slotConfig.set(this.sdk.tokens.USDT.address, [2, false]);
    slotConfig.set(this.sdk.tokens.WETH.address, [3, false]);
    slotConfig.set(this.sdk.tokens.BEAN.address, [0, false]);
    slotConfig.set(this.sdk.tokens.UNRIPE_BEAN.address, [0, false]);
    slotConfig.set(this.sdk.tokens.UNRIPE_BEAN_WSTETH.address, [0, false]);
    slotConfig.set(this.sdk.tokens.BEAN_ETH_WELL_LP.address, [51, false]);
    slotConfig.set(this.sdk.tokens.BEAN_WSTETH_WELL_LP.address, [51, false]);
    slotConfig.set(this.sdk.tokens.WSTETH.address, [0, false]);
    return slotConfig.get(tokenAddress);
  }

  /**
   * Writes the new bean & 3crv balances to the evm storage
   */
  async setBalance(token: Token | string, account: string, balance: TokenValue | number) {
    const _token = token instanceof Token ? token : this.sdk.tokens.findByAddress(token);
    if (!_token) {
      throw new Error("token not found");
    }
    const _balance = typeof balance === "number" ? _token.amount(balance) : balance;
    const balanceAmount = _balance.toBigNumber();

    if (_token.symbol === "ETH") {
      return this.sdk.provider.send("hardhat_setBalance", [account, balanceAmount.toHexString()]);
    }

    const [slot, isTokenReverse] = this.getBalanceConfig(_token.address);
    const values = [account, slot];

    if (isTokenReverse) values.reverse();

    const index = ethers.utils.solidityKeccak256(["uint256", "uint256"], values);
    await this.setStorageAt(
      _token.address,
      index.toString(),
      this.toBytes32(balanceAmount).toString()
    );
  }

  async setWellLiquidity(
    lpToken: Token,
    amounts: TokenValue[],
    account = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  ) {
    const well = await this.sdk.wells.getWell(lpToken.address);
    const tokens = well.tokens;

    for await (const [index, token] of (tokens || []).entries()) {
      const amount = amounts[index];
      await this.setBalance(token, account, amount);
      await token.approve(well.address, amount);
    }

    const tx = await well.addLiquidity(amounts, TokenValue.ONE, account);
    await tx.wait();
  }

  /**
   * DeltaB is currently under 0. We need to BUY beans to bring the price over 1
   */
  async setPriceOver1(multiplier = 1, account = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266") {
    let deltaB = await this.sdk.bean.getDeltaB();
    if (deltaB.gte(TokenValue.ZERO)) {
      console.log("DeltaB already over 0, skipping");
      return;
    }
    const op = this.sdk.swap.buildSwap(this.sdk.tokens.WSTETH, this.sdk.tokens.BEAN, account);
    const beanAmountToBuy = deltaB.abs().mul(multiplier);
    const quote = await op.estimateReversed(beanAmountToBuy);
    console.log(
      `DeltaB is ${deltaB.toHuman()}. BUYING ${beanAmountToBuy.toHuman()} BEANS (with a ${multiplier}x multiplier)`
    );

    await this.setBalance(this.sdk.tokens.WSTETH, account, quote);
    const txa = await this.sdk.tokens.WSTETH.approveBeanstalk(quote);
    await txa.wait();

    const tx = op.execute(quote, 0.2);
    await (await tx).wait();
    deltaB = await this.sdk.bean.getDeltaB();

    if (!deltaB.gte(TokenValue.ZERO)) {
      throw new Error(`DeltaB is still under 0 after buying beans. deltaB: ${deltaB.toHuman()}`);
    }
  }

  /**
   * DeltaB is currently over 0. We need to SELL beans to bring the price below 1
   */
  async setPriceUnder1(multiplier = 1, account = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266") {
    let deltaB = await this.sdk.bean.getDeltaB();
    if (deltaB.lt(TokenValue.ZERO)) {
      console.log("DeltaB already under zero, skipping");
      return;
    }
    const op = this.sdk.swap.buildSwap(this.sdk.tokens.BEAN, this.sdk.tokens.WSTETH, account);
    const amount = deltaB.abs().mul(multiplier);
    console.log(
      `DeltaB is ${deltaB.toHuman()}. SELLING ${amount.toHuman()} BEANS (with a ${multiplier}x multiplier)`
    );

    await this.setBalance(this.sdk.tokens.BEAN, account, amount);
    const txa = await this.sdk.tokens.BEAN.approveBeanstalk(amount);
    await txa.wait();

    const tx = await op.execute(amount, 0.2);
    await tx.wait();

    deltaB = await this.sdk.bean.getDeltaB();

    if (!deltaB.lt(TokenValue.ZERO)) {
      throw new Error(`DeltaB is still over 0 after buying beans. deltaB: ${deltaB.toHuman()}`);
    }
  }

  private async setStorageAt(address: string, index: string, value: string) {
    await this.sdk.provider.send("hardhat_setStorageAt", [address, index, value]);
  }

  private toBytes32(bn: ethers.BigNumber) {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
  }

  mockDepositCrate(
    token: ERC20Token,
    _season: number,
    _amount: string,
    _currentSeason?: number,
    _germinatingStem: ethers.BigNumber = ethers.constants.Zero,
    _stem?: number,
    _stemTipForToken?: number
  ) {
    const amount = token.amount(_amount);
    const bdv = TokenValue.fromHuman(amount.toHuman(), 6);
    const currentSeason = _currentSeason || _season + 100;

    return makeDepositObject(token, ethers.BigNumber.from(_stemTipForToken || _season), {
      id: ethers.constants.Zero,
      stem: _stem || currentSeason, // FIXME
      amount: amount.toBlockchain(),
      bdv: bdv.toBlockchain(),
      germinatingStem: _germinatingStem
    });
  }

  ethersError(e: any) {
    return `${(e as any).error?.reason || (e as any).toString()}`;
  }

  async sunriseForward() {
    // Calculate how many seconds till next hour
    const block = await this.sdk.provider.send("eth_getBlockByNumber", ["latest", false]);
    const blockTs = parseInt(block.timestamp, 16);
    const blockDate = new Date(blockTs * 1000);
    const secondsTillNextHour = (3600000 - (blockDate.getTime() % 3600000)) / 1000;

    // fast forward evm, to just past the hour and mine a new block
    await this.sdk.provider.send("evm_increaseTime", [secondsTillNextHour + 5]);
    await this.sdk.provider.send("evm_mine", []);

    // call sunrise
    const res = await this.sdk.contracts.beanstalk.sunrise();
    await res.wait();

    // get the new season
    const season = await this.sdk.contracts.beanstalk.season();

    return season;
  }

  async forceBlock() {
    await this.sdk.provider.send("evm_increaseTime", [12]);
    await this.sdk.provider.send("evm_mine", []);
  }
}
