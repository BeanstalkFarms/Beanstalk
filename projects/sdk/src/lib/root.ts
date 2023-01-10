import { ethers, Overrides } from "ethers";
import { ERC20Token } from "src/classes/Token";
import { DepositTransferStruct } from "src/constants/generated/projects/sdk/src/constants/abi/Ecosystem/Root";
import { TokenSiloBalance } from "src/lib/silo";
import { TokenValue } from "src/TokenValue";

import { BeanstalkSDK } from "./BeanstalkSDK";
import { FarmToMode } from "./farm/types";
import { SignedPermit } from "./permit";
import { DepositTokenPermitMessage, DepositTokensPermitMessage } from "./silo.utils";

// const PRECISION = ethers.utils.parseEther("1");
const PRECISION = TokenValue.fromBlockchain(ethers.utils.parseEther("1"), 18);

const logtv = (tokv: TokenValue) => [tokv.toBlockchain(), tokv.toHuman(), tokv.decimals];

export class Root {
  static sdk: BeanstalkSDK;

  /** @DISCUSS this pattern */
  static address: string;

  constructor(sdk: BeanstalkSDK) {
    Root.sdk = sdk;
    Root.address = sdk.contracts.root.address;
  }

  /**
   * Mint ROOT tokens. The `Root.sol` contract supports Beanstalk's
   * Deposit Transfer permits; this function unpacks a provided
   * signed permit into the proper argument slots.
   *
   * @dev Passing _overrides directly as the last parameter
   * of a contract method seems to make ethers treat it like
   * a parameter for the contract call. Instead, we unpack and
   * thus pass an empty object for overrides if _overrides is undef.
   */
  async mint(
    _depositTransfers: DepositTransferStruct[],
    _destination: FarmToMode,
    _minAmountOut: ethers.BigNumber, // FIXME
    _permit?: SignedPermit<DepositTokenPermitMessage | DepositTokensPermitMessage>,
    _overrides?: Overrides
  ) {
    if (_permit) {
      if ((_permit as SignedPermit<DepositTokenPermitMessage>).typedData.message.token) {
        let permit = _permit as SignedPermit<DepositTokenPermitMessage>;
        return Root.sdk.contracts.root.mintWithTokenPermit(
          _depositTransfers,
          _destination,
          _minAmountOut, // FIXME
          permit.typedData.message.token,
          permit.typedData.message.value,
          permit.typedData.message.deadline,
          permit.split.v,
          permit.split.r,
          permit.split.s,
          { ..._overrides }
        );
      } else if ((_permit as SignedPermit<DepositTokensPermitMessage>).typedData.message.tokens) {
        let permit = _permit as SignedPermit<DepositTokensPermitMessage>;
        return Root.sdk.contracts.root.mintWithTokensPermit(
          _depositTransfers,
          _destination,
          _minAmountOut, // FIXME
          permit.typedData.message.tokens,
          permit.typedData.message.values,
          permit.typedData.message.deadline,
          permit.split.v,
          permit.split.r,
          permit.split.s,
          { ..._overrides }
        );
      } else {
        throw new Error("Malformatted permit");
      }
    }

    return Root.sdk.contracts.root.mint(_depositTransfers, _destination, _minAmountOut, { ..._overrides });
  }

  async underlyingBdv() {
    return Root.sdk.contracts.root.underlyingBdv().then((v) => Root.sdk.tokens.BEAN.fromBlockchain(v));
  }

  /**
   * Off-chain estimation for the number of ROOT minted from a set of
   * `deposits` of `token`.
   * @param token
   * @param deposits
   * @param isDeposit
   */
  async estimateRoots(token: ERC20Token, deposits: TokenSiloBalance["deposited"]["crates"], isDeposit: boolean) {
    // @dev note that sdk.tokens.ROOT.getContract() == sdk.contracts.root.
    const [rootTotalSupply, rootUnderlyingBdvBefore, rootAllStalk, rootSeedsBefore] = await Promise.all([
      Root.sdk.tokens.ROOT.getTotalSupply(), // automaticaly pulls as TokenValue
      this.underlyingBdv(),
      Root.sdk.silo.getAllStalk(Root.sdk.contracts.root.address), // include grown
      Root.sdk.silo.getSeeds(Root.sdk.contracts.root.address)
    ]);

    const rootStalkBefore = rootAllStalk.active.add(rootAllStalk.grown);

    // TODO: move these to an example
    console.log("root total supply", rootTotalSupply.toHuman());
    console.log("root underlying bdv before", rootUnderlyingBdvBefore.toHuman());
    console.log("root stalk before", rootStalkBefore.toHuman());
    console.log("root seeds before", rootSeedsBefore.toHuman());

    const {
      bdv: totalBdvFromDeposits,
      stalk: totalStalkFromDeposits,
      seeds: totalSeedsFromDeposits
    } = Root.sdk.silo.sumDeposits(token, deposits);

    console.log("bdv from deposits", totalBdvFromDeposits.toHuman());
    console.log("stalk from deposits", totalStalkFromDeposits.toHuman());
    console.log("seeds from deposits", totalSeedsFromDeposits.toHuman());

    const rootUnderlyingBdvAfter = isDeposit
      ? rootUnderlyingBdvBefore.add(totalBdvFromDeposits)
      : rootUnderlyingBdvBefore.sub(totalBdvFromDeposits);
    const rootStalkAfter = rootStalkBefore.add(totalStalkFromDeposits);
    const rootSeedsAfter = rootSeedsBefore.add(totalSeedsFromDeposits);

    console.log("root underlying bdv after", rootUnderlyingBdvAfter.toHuman());
    console.log("root stalk after", rootStalkAfter.toHuman());
    console.log("root seeds after", rootSeedsAfter.toHuman());

    // First-time minting
    if (rootTotalSupply.eq(0)) {
      return {
        amount: TokenValue.fromBlockchain(totalStalkFromDeposits.mul(1e8).toBlockchain(), 18),
        bdvRatio: TokenValue.fromHuman("100", 18),
        stalkRatio: TokenValue.fromHuman("100", 18),
        seedsRatio: TokenValue.fromHuman("100", 18),
        min: TokenValue.fromHuman("100", 18)
      };
    }

    // Deposit
    else if (isDeposit) {
      // Calculate ratios
      const bdvRatio = PRECISION.mulDiv(rootUnderlyingBdvAfter, rootUnderlyingBdvBefore, "down");
      const stalkRatio = PRECISION.mulDiv(rootStalkAfter, rootStalkBefore, "down");
      const seedsRatio = PRECISION.mulDiv(rootSeedsAfter, rootSeedsBefore, "down");

      // Root minting uses the minimum of the increase in bdv/stalk/seeds.
      const min = TokenValue.min(bdvRatio, stalkRatio, seedsRatio);
      const amount = rootTotalSupply.mulDiv(min, PRECISION, "down").sub(rootTotalSupply);

      console.log({
        bdvRatio: logtv(bdvRatio),
        stalkRatio: logtv(stalkRatio),
        seedsRatio: logtv(seedsRatio)
      });

      return {
        amount, // 18 (ROOT)
        bdvRatio, // 18 (PRECISION)
        stalkRatio, // 18 (PRECISION)
        seedsRatio, // 18 (PRECISION)
        min // 18 (PRECISION)
      };
    }

    // Withdraw
    else {
      const bdvRatio = PRECISION.mulDiv(rootUnderlyingBdvAfter, rootUnderlyingBdvBefore, "up");
      const stalkRatio = PRECISION.mulDiv(rootStalkAfter, rootStalkBefore, "up");
      const seedsRatio = PRECISION.mulDiv(rootSeedsAfter, rootSeedsBefore, "up");

      console.log({
        bdvRatio: logtv(bdvRatio),
        stalkRatio: logtv(stalkRatio),
        seedsRatio: logtv(seedsRatio)
      });

      // Root burning uses the maximum of the decrease in bdv/stalk/seeds.
      const max = TokenValue.max(bdvRatio, stalkRatio, seedsRatio);
      const amount = rootTotalSupply.sub(rootTotalSupply.mulDiv(max, PRECISION));

      return {
        amount, // 18 (ROOT)
        bdvRatio, // 18 (PRECISION)
        stalkRatio, // 18 (PRECISION)
        seedsRatio, // 18 (PRECISION)
        max // 18 (PRECISION)
      };
    }
  }
}
