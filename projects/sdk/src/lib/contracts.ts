import { BaseContract } from "ethers";
import type { BeanstalkSDK } from "./BeanstalkSDK";
import {
  Beanstalk__factory,
  Beanstalk,
  BeanstalkFertilizer__factory,
  Root,
  Root__factory,
  Pipeline,
  Pipeline__factory,
  BeanstalkFertilizer,
  Depot__factory,
  Depot,
  BeanstalkPrice__factory,
  BeanstalkPrice,
  UsdOracle,
  UsdOracle__factory,
  UniswapV3Router__factory,
  UniswapV3Router,
  UniswapV3QuoterV2__factory,
  UniswapV3QuoterV2,
  Wsteth__factory,
  Wsteth,
  UnwrapAndSendEthJunction,
  UnwrapAndSendEthJunction__factory,
  Junction,
  Junction__factory,
  Curve3Pool,
  CurveCryptoFactory,
  CurveMetaFactory,
  CurveMetaPool,
  CurveRegistry,
  CurveTriCrypto2Pool,
  CurveZap,
  Curve3Pool__factory,
  CurveCryptoFactory__factory,
  CurveMetaFactory__factory,
  CurveMetaPool__factory,
  CurveRegistry__factory,
  CurveTriCrypto2Pool__factory,
  CurveZap__factory
} from "src/constants/generated";

type LidoContracts = {
  wsteth: Wsteth;
};

type PipelineJunctions = {
  unwrapAndSendEth: UnwrapAndSendEthJunction;
};

export class Contracts {
  static sdk: BeanstalkSDK;

  public readonly beanstalk: Beanstalk;
  public readonly beanstalkRead: Beanstalk;
  public readonly beanstalkPrice: BeanstalkPrice;
  public readonly fertilizer: BeanstalkFertilizer;

  public readonly pipeline: Pipeline;
  public readonly depot: Depot;
  public readonly junction: Junction;
  public readonly usdOracle: UsdOracle;
  public readonly pipelineJunctions: PipelineJunctions;

  public readonly lido: LidoContracts;

  // Deprecated contracts
  /**
   * @deprecated
   * @description External contract not part of Beanstalk3 L2 migration.
   * @note mainnet Beanstalk only
   */
  public readonly root: Root | null = null;

  /**
   * @deprecated as of Beanstalk 3.0 L2 migration
   * @description mainnet only
   */
  public readonly uniswapV3Router: UniswapV3Router;

  /**
   * @deprecated as of Beanstalk 3.0 L2 migration
   * @description mainnet only
   */
  public readonly uniswapV3QuoterV2: UniswapV3QuoterV2;

  constructor(sdk: BeanstalkSDK) {
    Contracts.sdk = sdk;

    // ---------- Addresses ----------
    // Beanstalk
    const beanstalkAddress = sdk.addresses.BEANSTALK.get(sdk.chainId);
    const beanstalkFertilizerAddress = sdk.addresses.BEANSTALK_FERTILIZER.get(sdk.chainId);
    const beanstalkPriceAddress = sdk.addresses.BEANSTALK_PRICE.get(sdk.chainId);

    // Ecosystem
    const pipelineAddress = sdk.addresses.PIPELINE.get(sdk.chainId);
    const depotAddress = sdk.addresses.DEPOT.get(sdk.chainId);
    const junctionAddress = sdk.addresses.JUNCTION.get(sdk.chainId);
    const rootAddress = sdk.addresses.ROOT.get(sdk.chainId);
    const unwrapAndSendEthAddress = sdk.addresses.UNWRAP_AND_SEND_ETH.get(sdk.chainId);
    const usdOracleAddress = sdk.addresses.USD_ORACLE.get(sdk.chainId);

    // Lido
    const wstEthAddress = sdk.addresses.WSTETH.get(sdk.chainId);

    // Uniswap
    const uniswapV3RouterAddress = sdk.addresses.UNISWAP_V3_ROUTER.get(sdk.chainId);
    const uniswapV3QuoterV2Address = sdk.addresses.UNISWAP_V3_QUOTER_V2.get(sdk.chainId);

    // ---------- Instances ----------
    // Beanstalk
    this.beanstalk = Beanstalk__factory.connect(beanstalkAddress, sdk.providerOrSigner);
    this.beanstalkRead = Beanstalk__factory.connect(
      beanstalkAddress,
      sdk.readProvider ?? sdk.providerOrSigner
    );
    this.beanstalkPrice = BeanstalkPrice__factory.connect(
      beanstalkPriceAddress,
      sdk.providerOrSigner
    );
    this.fertilizer = BeanstalkFertilizer__factory.connect(
      beanstalkFertilizerAddress,
      sdk.providerOrSigner
    );

    // Ecosystem
    this.pipeline = Pipeline__factory.connect(pipelineAddress, sdk.providerOrSigner);
    this.depot = Depot__factory.connect(depotAddress, sdk.providerOrSigner);
    this.junction = Junction__factory.connect(junctionAddress, sdk.providerOrSigner);
    if (unwrapAndSendEthAddress) {
      this.pipelineJunctions = {
        unwrapAndSendEth: UnwrapAndSendEthJunction__factory.connect(
          unwrapAndSendEthAddress,
          sdk.providerOrSigner
        )
      };
    }
    if (rootAddress) {
      this.root = Root__factory.connect(rootAddress, sdk.providerOrSigner);
    }
    if (usdOracleAddress) {
      this.usdOracle = UsdOracle__factory.connect(usdOracleAddress, sdk.providerOrSigner);
    }

    // Lido
    this.lido = {
      wsteth: Wsteth__factory.connect(wstEthAddress, sdk.providerOrSigner)
    };

    // Uniswap
    if (uniswapV3RouterAddress) {
      this.uniswapV3Router = UniswapV3Router__factory.connect(
        uniswapV3RouterAddress,
        sdk.providerOrSigner
      );
    }

    if (uniswapV3QuoterV2Address) {
      this.uniswapV3QuoterV2 = UniswapV3QuoterV2__factory.connect(
        uniswapV3QuoterV2Address,
        sdk.providerOrSigner
      );
    }
  }
}
