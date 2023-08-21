import { TokenValue } from "@beanstalk/sdk-core";
import { Depot, Depot__factory, WETH9, WETH9__factory } from "src/constants/generated";
import { addresses } from "src/constants/addresses";
import { WellsSDK } from "src/lib/WellsSDK";
import { TxOverrides, Well } from "src/lib/Well";
import { ContractTransaction } from "ethers";
import { Clipboard } from "src/lib/clipboard/clipboard";

export class AddLiquidityETH {
  private readonly sdk: WellsSDK;
  private readonly depot: Depot;
  private readonly weth9: WETH9;
  private readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  debug: boolean = false;

  constructor(sdk: WellsSDK) {
    this.sdk = sdk;
    this.weth9 = WETH9__factory.connect(addresses.WETH9.get(this.sdk.chainId), this.sdk.providerOrSigner);
    this.depot = Depot__factory.connect(addresses.DEPOT.get(this.sdk.chainId), this.sdk.providerOrSigner);
  }

  generateSteps(well: Well, amounts: TokenValue[], quote: TokenValue, account: string) {
    let ethAmount: TokenValue = TokenValue.ZERO;
    let tokenTransfers: any[] = [];

    for (let i = 0; i < well.tokens!.length; i++) {
      if (well.tokens![i].symbol !== "WETH") {
        // SEND NON-WETH TOKEN(S) TO WELL
        const tokenTransfer = this.depot.interface.encodeFunctionData("transferToken", [
          well.tokens![i].address,
          well.address,
          amounts[i].toBigNumber(),
          0,
          0
        ]);
        tokenTransfers.push(tokenTransfer);
      } else {
        ethAmount = amounts[i];
      }
    }

    // CONVERT ETH TO WETH
    const wrapEth = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("deposit"),
        clipboard: Clipboard.encode([], ethAmount!.toBigNumber())
    };

    // SEND WETH TO WELL
    const wethTransfer = {
        target: this.weth9.address,
        callData: this.weth9.interface.encodeFunctionData("transfer", [well.address, ethAmount.toBigNumber()]),
        clipboard: Clipboard.encode([])
    };

    // SYNC TO USER
    const syncWell = {
        target: well.address,
        callData: well.contract.interface.encodeFunctionData("sync", [account, quote.toBlockchain()]),
        clipboard: Clipboard.encode([])
    };

    // ENCODE ADVANCEDPIPE
    const pipe = this.depot.interface.encodeFunctionData("advancedPipe", [
        [wrapEth, wethTransfer, syncWell],
        ethAmount.toBlockchain()
    ]);

    return { steps: [...tokenTransfers, pipe], ethAmount: ethAmount };
  }

  async doGasEstimate(well: Well, amounts: TokenValue[], quote: TokenValue, account?: string, overrides: TxOverrides = {}): Promise<TokenValue> {
    const { steps, ethAmount } = this.generateSteps(well, amounts, quote, account || this.ZERO_ADDRESS);
    const overrideOptions = { ...overrides, value: ethAmount.toBigNumber(), gasLimit: 5000000 };
    const gas = await this.depot.estimateGas.farm(steps, overrideOptions);
    return TokenValue.fromBlockchain(gas, 0);
  };

  async addLiquidity(well: Well, amounts: TokenValue[], quote: TokenValue, account: string, gasEstimate: TokenValue, overrides: TxOverrides = {}): Promise<ContractTransaction> {
    const { steps, ethAmount } = this.generateSteps(well, amounts, quote, account);
    const overrideOptions = { ...overrides, value: ethAmount.toBigNumber(), gasLimit: gasEstimate.toBlockchain() };
    return this.depot.farm(steps, overrideOptions);
  };
};

