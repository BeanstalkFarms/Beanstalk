var fs = require('fs');


const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const LUSD_3_CURVE = "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA";
const BEAN_LUSD_CURVE = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNISWAP_V2_PAIR = '0x87898263B6C5BABe34b4ec53F22d98430b91e371';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';

async function curve() {
    // Deploy 3 Curve
    let threeCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/Mock3Curve.sol/Mock3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      THREE_CURVE,
      JSON.parse(threeCurveJson).deployedBytecode,
    ]);

    // Deploy Bean Metapool
    let bean3CurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockMeta3Curve.sol/MockMeta3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_3_CURVE,
      JSON.parse(bean3CurveJson).deployedBytecode,
    ]);
    // const beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);

    // Deploy LUSD Metapool
    let lusd3CurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockMeta3Curve.sol/MockMeta3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      LUSD_3_CURVE,
      JSON.parse(bean3CurveJson).deployedBytecode,
    ]);

    let beanLusdCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockPlainCurve.sol/MockPlainCurve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_LUSD_CURVE,
      JSON.parse(beanLusdCurveJson).deployedBytecode,
    ]);
    // const plainPool = await ethers.getContractAt('MockPlainCurve', BEAN_3_CURVE);

    return [BEAN_3_CURVE, THREE_CURVE];
}

async function router() {
    let routerJson = fs.readFileSync(`./artifacts/contracts/mocks/MockUniswapV2Router.sol/MockUniswapV2Router.json`);

    await network.provider.send("hardhat_setCode", [
      UNISWAP_V2_ROUTER,
      JSON.parse(routerJson).deployedBytecode,
    ]);
    const mockRouter =  await ethers.getContractAt("MockUniswapV2Router", UNISWAP_V2_ROUTER); 

    let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockWETH.sol/MockWETH.json`);

    await network.provider.send("hardhat_setCode", [
        WETH,
        JSON.parse(tokenJson).deployedBytecode,
    ]);

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

exports.impersonateRouter = router
exports.impersonateBean = bean
exports.impersonateCurve = curve
exports.impersonatePool = pool