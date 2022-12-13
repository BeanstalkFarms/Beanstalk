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
  ETH_USDC_UNISWAP_V3
} = require('../test/utils/constants');
const { impersonateSigner, mintEth } = require('../utils');

const { getSigner } = '../utils'

async function curve() {
  // Deploy 3 Curveadd
  await usdc()
  let threePoolJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/Mock3Curve.sol/Mock3Curve.json`);
  await network.provider.send("hardhat_setCode", [
    THREE_POOL,
    JSON.parse(threePoolJson).deployedBytecode,
  ]);

  const threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
  await threePool.set_virtual_price(ethers.utils.parseEther('1'));

  let threeCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);
  await network.provider.send("hardhat_setCode", [
    THREE_CURVE,
    JSON.parse(threeCurveJson).deployedBytecode,
  ]);

  let curveFactoryJson = fs.readFileSync(`./artifacts/contracts/mocks/Curve/MockCurveFactory.sol/MockCurveFactory.json`);
  await network.provider.send("hardhat_setCode", [
    STABLE_FACTORY,
    JSON.parse(curveFactoryJson).deployedBytecode,
  ]);

  await network.provider.send("hardhat_setCode", [
    CURVE_REGISTRY,
    JSON.parse(threeCurveJson).deployedBytecode,
  ]);
  const curveStableFactory = await ethers.getContractAt("MockCurveFactory", STABLE_FACTORY);
  await curveStableFactory.set_coins(BEAN_3_CURVE, [BEAN, THREE_CURVE, ZERO_ADDRESS, ZERO_ADDRESS]);

  let curveZapJson = fs.readFileSync(`./artifacts/contracts/mocks/Curve/MockCurveZap.sol/MockCurveZap.json`);
  await network.provider.send("hardhat_setCode", [
    CURVE_ZAP,
    JSON.parse(curveZapJson).deployedBytecode,
  ]);
  const curveZap = await ethers.getContractAt("MockCurveZap", CURVE_ZAP);
  await curveZap.approve()

}

async function curveMetapool() {

    // Deploy Bean Metapool
    let meta3CurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockMeta3Curve.sol/MockMeta3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_3_CURVE,
      JSON.parse(meta3CurveJson).deployedBytecode,
    ]);
    // const beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);

    const beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    await beanMetapool.init(BEAN, THREE_CURVE, THREE_POOL);
    await beanMetapool.set_A_precise('1000');
    await beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
  
}

async function weth() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockWETH.sol/MockWETH.json`);

  await network.provider.send("hardhat_setCode", [
      WETH,
      JSON.parse(tokenJson).deployedBytecode,
  ]);
}

async function router() {
    let routerJson = fs.readFileSync(`./artifacts/contracts/mocks/MockUniswapV2Router.sol/MockUniswapV2Router.json`);

    await network.provider.send("hardhat_setCode", [
      UNISWAP_V2_ROUTER,
      JSON.parse(routerJson).deployedBytecode,
    ]);
    const mockRouter =  await ethers.getContractAt("MockUniswapV2Router", UNISWAP_V2_ROUTER); 

    await mockRouter.setWETH(WETH);

    return UNISWAP_V2_ROUTER;
}

async function pool() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockUniswapV2Pair.sol/MockUniswapV2Pair.json`);
  await network.provider.send("hardhat_setCode", [
    UNISWAP_V2_PAIR,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const pair = await ethers.getContractAt("MockUniswapV2Pair", UNISWAP_V2_PAIR);
  await pair.resetLP();
  await pair.setToken(BEAN);
  return UNISWAP_V2_PAIR;
}

async function curveLUSD() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);
    await network.provider.send("hardhat_setCode", [
      LUSD,
      JSON.parse(tokenJson).deployedBytecode,
    ]);

    const lusd = await ethers.getContractAt("MockToken", LUSD);
    await lusd.setDecimals(18);
  
    await network.provider.send("hardhat_setCode", [
      LUSD_3_CURVE,
      JSON.parse(meta3CurveJson).deployedBytecode,
    ]);

    let beanLusdCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockPlainCurve.sol/MockPlainCurve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_LUSD_CURVE,
      JSON.parse(beanLusdCurveJson).deployedBytecode,
    ]);

    const lusdMetapool = await ethers.getContractAt('MockMeta3Curve', LUSD_3_CURVE);
    await lusdMetapool.init(LUSD, THREE_CURVE, THREE_CURVE);

    const beanLusdPool = await ethers.getContractAt('MockPlainCurve', BEAN_LUSD_CURVE);
    await beanLusdPool.init(BEAN, LUSD);
}

async function bean() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

  await network.provider.send("hardhat_setCode", [
    BEAN,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const bean = await ethers.getContractAt("MockToken", BEAN);
  await bean.setDecimals(6);
  return BEAN;
}

async function usdc() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);
  await network.provider.send("hardhat_setCode", [
    USDC,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const usdc = await ethers.getContractAt("MockToken", USDC);
  await usdc.setDecimals(6);
}

async function fertilizer() {
  // let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

  // await network.provider.send("hardhat_setCode", [
  //   BARN_RAISE,
  //   JSON.parse(tokenJson).deployedBytecode,
  // ]);
}

async function unripe() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

  await network.provider.send("hardhat_setCode", [
    UNRIPE_BEAN,
    JSON.parse(tokenJson).deployedBytecode,
  ]);

  const unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
  await unripeBean.setDecimals(6);

  await network.provider.send("hardhat_setCode", [
    UNRIPE_LP,
    JSON.parse(tokenJson).deployedBytecode,
  ]);
}

async function price() {
  const priceDeployer = await impersonateSigner(PRICE_DEPLOYER)
  await mintEth(PRICE_DEPLOYER)
  const Price = await ethers.getContractFactory('BeanstalkPrice')
  const price = await Price.connect(priceDeployer).deploy()
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
  let basefeeJson = fs.readFileSync(`./artifacts/contracts/mocks/MockBlockBasefee.sol/MockBlockBasefee.json`);

  await network.provider.send("hardhat_setCode", [
    BASE_FEE_CONTRACT,
    JSON.parse(basefeeJson).deployedBytecode,
  ]);

  const basefee = await ethers.getContractAt("MockBlockBasefee", BASE_FEE_CONTRACT);
  await basefee.setAnswer(20 * Math.pow(10, 9));
}

async function ethUsdcUniswap() {
  const MockUniswapV3Factory = await ethers.getContractFactory('MockUniswapV3Factory')
  const mockUniswapV3Factory = await MockUniswapV3Factory.deploy()
  await mockUniswapV3Factory.deployed()
  const ethUdscPool = await mockUniswapV3Factory.callStatic.createPool(WETH, USDC, 3000)
  await mockUniswapV3Factory.createPool(WETH, USDC, 3000)
  const bytecode = await ethers.provider.getCode(ethUdscPool)
  await network.provider.send("hardhat_setCode", [
    ETH_USDC_UNISWAP_V3,
    bytecode,
  ]);
}

exports.impersonateRouter = router
exports.impersonateBean = bean
exports.impersonateCurve = curve
exports.impersonateCurveMetapool = curveMetapool 
exports.impersonateCurveLUSD = curveLUSD
exports.impersonatePool = pool
exports.impersonateWeth = weth
exports.impersonateUnripe = unripe
exports.impersonateFertilizer = fertilizer
exports.impersonateUsdc = usdc
exports.impersonatePrice = price
exports.impersonateBlockBasefee = blockBasefee;
exports.impersonateEthUsdcUniswap = ethUsdcUniswap
exports.impersonateBeanstalk = impersonateBeanstalk
