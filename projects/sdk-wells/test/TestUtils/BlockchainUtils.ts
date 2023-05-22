import { BigNumber, ethers } from "ethers";
import { Token, TokenValue } from "@beanstalk/sdk-core";
import { WellsSDK } from "../../src/lib/WellsSDK";

export class BlockchainUtils {
  sdk: WellsSDK;
  provider: ethers.providers.JsonRpcProvider;

  constructor(sdk: WellsSDK) {
    this.sdk = sdk;
    this.provider = sdk.provider as ethers.providers.JsonRpcProvider; // fixme
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
      this.setUSDCBalance(account, this.sdk.tokens.USDC.amount(amount)),
      this.setWETHBalance(account, this.sdk.tokens.WETH.amount(amount)),
      this.setBEANBalance(account, this.sdk.tokens.BEAN.amount(amount)),
    ]);
  }
  async setETHBalance(account: string, balance: TokenValue) {
    await this.sdk.provider.send("hardhat_setBalance", [account, balance.toHex()]);
  }
  async setUSDCBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.USDC, account, balance);
  }
  async setWETHBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.WETH, account, balance);
  }
  async setBEANBalance(account: string, balance: TokenValue) {
    this.setBalance(this.sdk.tokens.BEAN, account, balance);
  }

  private getBalanceConfig(tokenAddress: string) {
    const slotConfig = new Map();
    slotConfig.set(this.sdk.tokens.USDC.address, [9, false]);
    slotConfig.set(this.sdk.tokens.WETH.address, [3, false]);
    slotConfig.set(this.sdk.tokens.BEAN.address, [0, false]);
    return slotConfig.get(tokenAddress);
  }

  /**
   * Writes the new balances to evm storage
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
    await this.setStorageAt(_token.address, index.toString(), this.toBytes32(balanceAmount).toString());
  }

  private async setStorageAt(address: string, index: string, value: string) {
    await this.sdk.provider.send("hardhat_setStorageAt", [address, index, value]);
  }

  private toBytes32(bn: ethers.BigNumber) {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
  }
}
