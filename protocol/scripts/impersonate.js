var fs = require('fs');

const {
  ZERO_ADDRESS,
  BEAN,
  THREE_CURVE,
  THREE_POOL,
  BEAN_3_CURVE,
  LUSD_3_CURVE,
  BEAN_LUSD_CURVE,
  UNISWAP_V2_ROUTER,
  UNISWAP_V2_PAIR,
  WETH,
  LUSD,
  UNRIPE_BEAN,
  UNRIPE_LP,
  USDC,
  CURVE_REGISTRY,
  CURVE_ZAP,
  STABLE_FACTORY,
  PRICE_DEPLOYER,
  BEANSTALK,
  BASE_FEE_CONTRACT,
  ETH_USDC_UNISWAP_V3,
  ETH_USDT_UNISWAP_V3,
  USDT,
  ETH_USD_CHAINLINK_AGGREGATOR,
  WSTETH
} = require('../test/utils/constants');
const { impersonatePipeline } = require('./pipeline');
const { impersonateDepot } = require('./depot');
const { impersonateSigner, mintEth } = require('../utils');
const { to18 } = require('../test/utils/helpers');

const { getSigner } = '../utils'

/**
 * @notice deploys the curve ecosystem relevant to beanstalk.
 * @dev Because bean3crv is dewhitelisted, this is kept for testing 
 * legacy functionality. 
 */
async function curve() {

  // 3-pool (DAI, USDC, USDT)
  await impersonateContractOnPath(
    `./artifacts/contracts/mocks/curve/Mock3Curve.sol/Mock3Curve.json`,
    THREE_POOL
  )

  const threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
  await threePool.set_virtual_price(ethers.utils.parseEther('1'));

  // 3crv token
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockToken.sol/MockToken.json',
    THREE_CURVE
  )

  // Stable Factory, Curve Registry, Curve Zap
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/curve/MockCurveFactory.sol/MockCurveFactory.json',
    STABLE_FACTORY
  )
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/curve/MockCurveFactory.sol/MockCurveFactory.json',
    CURVE_REGISTRY
  )
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/curve/MockCurveZap.sol/MockCurveZap.json',
    CURVE_ZAP
  )

  const curveStableFactory = await ethers.getContractAt("MockCurveFactory", STABLE_FACTORY);
  await curveStableFactory.set_coins(BEAN_3_CURVE, [BEAN, THREE_CURVE, ZERO_ADDRESS, ZERO_ADDRESS]);

  const curveZap = await ethers.getContractAt("MockCurveZap", CURVE_ZAP);
  await curveZap.approve()
}

async function curveMetapool(poolAddress, name, tokenAddress) {

  await impersonateContractOnPath(
    './artifacts/contracts/mocks/curve/MockMeta3Curve.sol/MockMeta3Curve.json',
    poolAddress
  )

  const beanMetapool = await ethers.getContractAt('MockMeta3Curve', poolAddress);
  await beanMetapool.init(tokenAddress, THREE_CURVE, THREE_POOL);
  await beanMetapool.set_A_precise('1000');
  await beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
  await beanMetapool.setSymbol(`${name}-f`);
}

/**
 * @notice deploys the bean3crv metapool.
 */
async function bean3CrvMetapool() {
  await curveMetapool(BEAN_3_CURVE, 'BEAN3CRV', BEAN);
}

/// WETH ///
async function weth() {
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockWETH.sol/MockWETH.json',
    WETH
  )
  const weth = await ethers.getContractAt("MockToken", WETH);
  await weth.setSymbol('WETH');
  await weth.setDecimals(18);
}

/// WstETH ///
async function wsteth() {
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockWsteth.sol/MockWsteth.json',
    WSTETH
  )
  const wsteth = await ethers.getContractAt('MockWsteth', WSTETH);
  await wsteth.setSymbol('wstETH');
  await wsteth.setStEthPerToken(to18('1'))
}

/// Uniswap V2 Router ///
async function router() {
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockUniswapV2Router.sol/MockUniswapV2Router.json',
    UNISWAP_V2_ROUTER
  )

  const mockRouter =  await ethers.getContractAt("MockUniswapV2Router", UNISWAP_V2_ROUTER); 
  await mockRouter.setWETH(WETH);
  return UNISWAP_V2_ROUTER;
}

/// Uniswap V2 Pair ///
async function pool() {
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockUniswapV2Pair.sol/MockUniswapV2Pair.json',
    UNISWAP_V2_PAIR
  )
  const pair = await ethers.getContractAt("MockUniswapV2Pair", UNISWAP_V2_PAIR);
  await pair.resetLP();
  await pair.setToken(BEAN);
  return UNISWAP_V2_PAIR;
}

async function bean() {
  await token(BEAN, 6)
  // if a new beanstalk is deployed, the bean token should use "BeanstalkERC20", 
  // rather than "MockToken".
 const bean = await ethers.getContractAt("MockToken", BEAN);
  await bean.setSymbol("BEAN");
  await bean.setName("Bean");
  return BEAN;
}

async function token(address, decimals) {
  await impersonateContractOnPath(
    './artifacts/contracts/mocks/MockToken.sol/MockToken.json',
    address
  )

  const token = await ethers.getContractAt("MockToken", address);
  await token.setDecimals(decimals);
}

async function unripe() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

  await network.provider.send("hardhat_setCode", [
    UNRIPE_BEAN,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
  await unripeBean.setDecimals(6);
  await unripeBean.setSymbol('urBEAN');

  await network.provider.send("hardhat_setCode", [
    UNRIPE_LP,
    JSON.parse(tokenJson).deployedBytecode,
  ]);
  const unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
  await unripeLP.setSymbol('urBEAN3CRV');
}

async function price(beanstalk = BEANSTALK) {
  const priceDeployer = await impersonateSigner(PRICE_DEPLOYER)
  await mintEth(PRICE_DEPLOYER)
  const Price = await ethers.getContractFactory('BeanstalkPrice')
  const price = await Price.connect(priceDeployer).deploy(beanstalk)
  await price.deployed()
}

async function impersonateBeanstalk(owner) {
  let beanstalkJson = fs.readFileSync(`./artifacts/contracts/mocks/MockDiamond.sol/MockDiamond.json`);

  await network.provider.send("hardhat_setCode", [
    BEANSTALK,
    JSON.parse(beanstalkJson).deployedBytecode,
  ]);

  beanstalk = await ethers.getContractAt('MockDiamond', BEANSTALK)
  await beanstalk.mockInit(owner);
}

async function blockBasefee() {
  await impersonateContractOnPath(
    `./artifacts/contracts/mocks/MockBlockBasefee.sol/MockBlockBasefee.json`,
    BASE_FEE_CONTRACT
  )

  const basefee = await ethers.getContractAt("MockBlockBasefee", BASE_FEE_CONTRACT);
  await basefee.setAnswer(20 * Math.pow(10, 9));
}

async function ethUsdcUniswap() {
  await uniswapV3(ETH_USDC_UNISWAP_V3, WETH, USDC, 3000);
}

async function ethUsdtUniswap() {
  await uniswapV3(ETH_USDT_UNISWAP_V3, WETH, USDT, 3000);
}

async function uniswapV3(poolAddress, token0, token1, fee) {
  const MockUniswapV3Factory = await ethers.getContractFactory('MockUniswapV3Factory')
  const mockUniswapV3Factory = await MockUniswapV3Factory.deploy()
  await mockUniswapV3Factory.deployed()
  const pool = await mockUniswapV3Factory.callStatic.createPool(token0, token1, fee)
  await mockUniswapV3Factory.createPool(token0, token1, fee)
  const bytecode = await ethers.provider.getCode(pool)
  await network.provider.send("hardhat_setCode", [
    poolAddress,
    bytecode,
  ]);
}

async function impersonateContractOnPath(artifactPath, deployAddress) {
  let basefeeJson = fs.readFileSync(artifactPath);

  await network.provider.send("hardhat_setCode", [
    deployAddress,
    JSON.parse(basefeeJson).deployedBytecode,
  ]);
}

async function impersonateContract(contractName, deployAddress) {
  contract = await (await ethers.getContractFactory(contractName)).deploy()
  await contract.deployed()
  const bytecode = await ethers.provider.getCode(contract.address)
  await network.provider.send("hardhat_setCode", [
    deployAddress,
    bytecode,
  ]);
  return await ethers.getContractAt(contractName, deployAddress)
}

async function chainlinkAggregator(address, decimals=6) {

  await impersonateContractOnPath(
    `./artifacts/contracts/mocks/chainlink/MockChainlinkAggregator.sol/MockChainlinkAggregator.json`,
    address
  )
  const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', address)
  await ethUsdChainlinkAggregator.setDecimals(decimals)
}

exports.impersonateRouter = router
exports.impersonateBean = bean
exports.impersonateCurve = curve
exports.impersonateCurveMetapool = curveMetapool
exports.impersonateBean3CrvMetapool = bean3CrvMetapool
exports.impersonatePool = pool
exports.impersonateWeth = weth
exports.impersonateUnripe = unripe
exports.impersonateToken = token
exports.impersonatePrice = price
exports.impersonateBlockBasefee = blockBasefee;
exports.impersonateEthUsdcUniswap = ethUsdcUniswap
exports.impersonateEthUsdtUniswap = ethUsdtUniswap
exports.impersonateBeanstalk = impersonateBeanstalk
exports.impersonateChainlinkAggregator = chainlinkAggregator
exports.impersonateContract = impersonateContract
exports.impersonateUniswapV3 = uniswapV3
exports.impersonateWsteth = wsteth
exports.impersonatePipeline = impersonatePipeline
exports.impersonateDepot = impersonateDepot