var fs = require('fs');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const THREE_CURVE = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const THREE_POOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const LUSD_3_CURVE = "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA";
const BEAN_LUSD_CURVE = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNISWAP_V2_PAIR = '0x87898263B6C5BABe34b4ec53F22d98430b91e371';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';
const LUSD = '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0';
const UNRIPE_BEAN = '0xD5BDcdEc5b2FEFf781eA8727969A95BbfD47C40e';
const UNRIPE_LP = '0x2e4243832DB30787764f152457952C8305f442e4';
const BARN_RAISE = '0x2E4243832db30787764F152457952C8305f442E5';
const TETHER = '';
const USDC = '';
const CURVE_STABLE_FACTORY = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4';
const CURVE_CRYPTO_FACTORY = '0x0959158b6040D32d04c301A72CBFD6b39E21c9AE';

async function curve() {
  // Deploy 3 Curve
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
    CURVE_STABLE_FACTORY,
    JSON.parse(curveFactoryJson).deployedBytecode,
  ]);

  await network.provider.send("hardhat_setCode", [
    CURVE_CRYPTO_FACTORY,
    JSON.parse(threeCurveJson).deployedBytecode,
  ]);

  const curveStableFactory = await ethers.getContractAt("MockCurveFactory", CURVE_STABLE_FACTORY);
  await curveStableFactory.set_coins(BEAN_3_CURVE, [BEAN, THREE_CURVE, ZERO_ADDRESS, ZERO_ADDRESS]);

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

async function barnRaise() {
  let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

  await network.provider.send("hardhat_setCode", [
    BARN_RAISE,
    JSON.parse(tokenJson).deployedBytecode,
  ]);
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

exports.impersonateRouter = router
exports.impersonateBean = bean
exports.impersonateCurve = curve
exports.impersonateCurveMetapool = curveMetapool
exports.impersonateCurveLUSD = curveLUSD
exports.impersonatePool = pool
exports.impersonateWeth = weth
exports.impersonateUnripe = unripe
exports.impersonateBarnRaise = barnRaise