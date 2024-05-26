var fs = require('fs');

const {
  ZERO_ADDRESS,
  BEAN,
  UNISWAP_V2_ROUTER,
  UNISWAP_V2_PAIR,
  WETH,
  LUSD,
  UNRIPE_BEAN,
  UNRIPE_LP,
  USDC,
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
const { impersonateSigner, mintEth } = require('../utils');
const { to18 } = require('../test/utils/helpers');

const { getSigner } = '../utils'

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
exports.impersonatePool = pool
exports.impersonateWeth = weth
exports.impersonateUnripe = unripe
exports.impersonateToken = token
exports.impersonatePrice = price
exports.impersonateEthUsdcUniswap = ethUsdcUniswap
exports.impersonateEthUsdtUniswap = ethUsdtUniswap
exports.impersonateBeanstalk = impersonateBeanstalk
exports.impersonateChainlinkAggregator = chainlinkAggregator
exports.impersonateContract = impersonateContract
exports.impersonateUniswapV3 = uniswapV3
exports.impersonateWsteth = wsteth
exports.impersonatePipeline = impersonatePipeline