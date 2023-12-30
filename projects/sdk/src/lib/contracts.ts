import type { BeanstalkSDK } from "./BeanstalkSDK";
import {
  Curve3Pool__factory,
  CurveTriCrypto2Pool__factory,
  CurveMetaPool__factory,
  Beanstalk__factory,
  CurveCryptoFactory__factory,
  CurveMetaFactory__factory,
  CurveRegistry__factory,
  CurveZap__factory,
  Beanstalk,
  Curve3Pool,
  CurveCryptoFactory,
  CurveMetaFactory,
  CurveMetaPool,
  CurveRegistry,
  CurveTriCrypto2Pool,
  CurveZap,
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
  Math,
  Math__factory,
  UsdOracle,
  UsdOracle__factory,
  UniswapV3Router__factory,
  UniswapV3Router,
  UniswapV3QuoterV2__factory,
  UniswapV3QuoterV2,
} from "src/constants/generated";
import { BaseContract } from "ethers";

type CurveContracts = {
  pools: {
    pool3: Curve3Pool;
    tricrypto2: CurveTriCrypto2Pool;
    beanCrv3: CurveMetaPool;
    [k: string]: BaseContract;
  };
  registries: {
    poolRegistry: CurveRegistry;
    metaFactory: CurveMetaFactory;
    cryptoFactory: CurveCryptoFactory;
    [k: string]: CurveRegistry | CurveMetaFactory | CurveCryptoFactory;
  };
  zap: CurveZap;
};

export class Contracts {
  static sdk: BeanstalkSDK;

  public readonly beanstalk: Beanstalk;
  public readonly beanstalkPrice: BeanstalkPrice;
  public readonly fertilizer: BeanstalkFertilizer;

  public readonly pipeline: Pipeline;
  public readonly depot: Depot; // temp
  public readonly root: Root;
  public readonly math: Math;
  public readonly usdOracle: UsdOracle;

  public readonly curve: CurveContracts;

  public readonly uniswapV3Router: UniswapV3Router;
  public readonly uniswapV3QuoterV2: UniswapV3QuoterV2;

  // private chain: string;

  constructor(sdk: BeanstalkSDK) {
    Contracts.sdk = sdk;

    // Addressses
    const beanstalkAddress = sdk.addresses.BEANSTALK.get(sdk.chainId);
    const beanstalkFertilizerAddress = sdk.addresses.BEANSTALK_FERTILIZER.get(sdk.chainId);
    const beanstalkPriceAddress = sdk.addresses.BEANSTALK_PRICE.get(sdk.chainId);

    const pipelineAddress = sdk.addresses.PIPELINE.get(sdk.chainId);
    const depotAddress = sdk.addresses.DEPOT.get(sdk.chainId);
    const mathAddress = sdk.addresses.MATH.get(sdk.chainId);
    const rootAddress = sdk.addresses.ROOT.get(sdk.chainId);
    const usdOracleAddress = sdk.addresses.USD_ORACLE.get(sdk.chainId);

    const beancrv3Address = sdk.addresses.BEAN_CRV3.get(sdk.chainId);
    const pool3Address = sdk.addresses.POOL3.get(sdk.chainId);
    const tricrypto2Address = sdk.addresses.TRICRYPTO2.get(sdk.chainId);
    const poolRegistryAddress = sdk.addresses.POOL_REGISTRY.get(sdk.chainId);
    const metaFactoryAddress = sdk.addresses.META_FACTORY.get(sdk.chainId);
    const cryptoFactoryAddress = sdk.addresses.CRYPTO_FACTORY.get(sdk.chainId);
    const zapAddress = sdk.addresses.CURVE_ZAP.get(sdk.chainId);

    const uniswapV3RouterAddress = sdk.addresses.UNISWAP_V3_ROUTER.get(sdk.chainId);
    const uniswapV3QuoterV2Address = sdk.addresses.UNISWAP_V3_QUOTER_V2.get(sdk.chainId);

    // Instances
    this.beanstalk = Beanstalk__factory.connect(beanstalkAddress, sdk.providerOrSigner);
    this.beanstalkPrice = BeanstalkPrice__factory.connect(beanstalkPriceAddress, sdk.providerOrSigner);
    this.fertilizer = BeanstalkFertilizer__factory.connect(beanstalkFertilizerAddress, sdk.providerOrSigner);

    this.pipeline = Pipeline__factory.connect(pipelineAddress, sdk.providerOrSigner);
    this.depot = Depot__factory.connect(depotAddress, sdk.providerOrSigner);
    this.math = Math__factory.connect(mathAddress, sdk.providerOrSigner);
    this.root = Root__factory.connect(rootAddress, sdk.providerOrSigner);
    this.usdOracle = UsdOracle__factory.connect(usdOracleAddress, sdk.providerOrSigner);

    const beanCrv3 = CurveMetaPool__factory.connect(beancrv3Address, sdk.providerOrSigner);
    const pool3 = Curve3Pool__factory.connect(pool3Address, sdk.providerOrSigner);
    const tricrypto2 = CurveTriCrypto2Pool__factory.connect(tricrypto2Address, sdk.providerOrSigner);
    const poolRegistry = CurveRegistry__factory.connect(poolRegistryAddress, sdk.providerOrSigner);
    const metaFactory = CurveMetaFactory__factory.connect(metaFactoryAddress, sdk.providerOrSigner);
    const cryptoFactory = CurveCryptoFactory__factory.connect(cryptoFactoryAddress, sdk.providerOrSigner);
    const zap = CurveZap__factory.connect(zapAddress, sdk.providerOrSigner);

    this.uniswapV3Router = UniswapV3Router__factory.connect(uniswapV3RouterAddress, sdk.providerOrSigner);
    this.uniswapV3QuoterV2 = UniswapV3QuoterV2__factory.connect(uniswapV3QuoterV2Address, sdk.providerOrSigner);

    this.curve = {
      pools: {
        beanCrv3,
        [beancrv3Address]: beanCrv3,
        pool3,
        [pool3Address]: pool3,
        tricrypto2,
        [tricrypto2Address]: tricrypto2
      },
      registries: {
        poolRegistry,
        [poolRegistryAddress]: poolRegistry,
        metaFactory,
        [metaFactoryAddress]: metaFactory,
        cryptoFactory,
        [cryptoFactoryAddress]: cryptoFactory
      },
      zap
    };
  }
}
