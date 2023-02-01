import { ContractTransaction } from "ethers";
import { TokenValue } from "src/classes/TokenValue";
import { BeanstalkSDK } from "../BeanstalkSDK";

export class Transfer {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Transfer.sdk = sdk;
  }

  /**
   * Initates a transfer of BEAN from the silo.
   * @param amount The desired amount to transfer. Must be 0 < amount <= total deposits for token
   * @param destinationAddress The destination address for the transfer
   * @returns Promise of Transaction
   */
  async transfer(amount: TokenValue, destinationAddress: string): Promise<ContractTransaction> {
    Transfer.sdk.debug("silo.transfer()", { amount, destinationAddress });

    const SOURCE_BEAN_TOKEN = Transfer.sdk.tokens.BEAN;

    const { deposited } = await Transfer.sdk.silo.getBalance(SOURCE_BEAN_TOKEN);
    Transfer.sdk.debug("silo.transfer(): deposited balance", { deposited });

    if (deposited.amount.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const season = await Transfer.sdk.sun.getSeason();

    const transferData = Transfer.sdk.silo.withdraw.calculateWithdraw(SOURCE_BEAN_TOKEN, amount, deposited.crates, season);
    Transfer.sdk.debug("silo.transfer(): transferData", { transferData });

    const seasons = transferData.crates.map((crate) => crate.season.toString());
    const amounts = transferData.crates.map((crate) => crate.amount.toBlockchain());

    let contractCall;

    if (seasons.length === 0) {
      throw new Error("Malformatted crates");
    }

    const sender = await Transfer.sdk.getAccount();
    if (seasons.length === 1) {
      contractCall = Transfer.sdk.contracts.beanstalk.transferDeposit(
        sender,
        destinationAddress,
        SOURCE_BEAN_TOKEN.address,
        seasons[0],
        amounts[0]
      );
    } else {
      contractCall = Transfer.sdk.contracts.beanstalk.transferDeposits(
        sender,
        destinationAddress,
        SOURCE_BEAN_TOKEN.address,
        seasons,
        amounts
      );
    }

    return contractCall;
  }
}
