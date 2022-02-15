var fs = require('fs');


const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const LUSD_TOKEN = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const TROVE_MANAGER = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const BORROWER_OPERATIONS = "0x24179CD81c9e782A4096035f7eC97fB8B783e007";
const SORTED_TROVES = "0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6";
const PRICE_FEED = "0x4c517D4e2C851CA76d7eC94B805269Df0f2201De";
const ACTIVE_POOL = "0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F";
const COLL_SURPLUS_POOL = "0x3D32e8b97Ed5881324241Cf03b2DA5E2EBcE5521";
const DEFAULT_POOL = "0x896a3F03176f05CFbb4f006BfCd8723F2B0D741C";
const STABILITY_POOL = "0x66017D22b0f8556afDd19FC67041899Eb65a21bb";
const GAS_POOL = "0x9555b042F969E561855e5F28cB1230819149A8d9";
const LQTY_STAKING = "0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d";
const LQTY_TOKEN = "0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D";

async function curve() {
    let threeCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/Mock3Curve.sol/Mock3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      THREE_CURVE,
      JSON.parse(threeCurveJson).deployedBytecode,
    ]);

    let bean3CurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockBean3Curve.sol/MockBean3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_3_CURVE,
      JSON.parse(bean3CurveJson).deployedBytecode,
    ]);
}

async function liquity() {

    let uniswapFactoryJson = fs.readFileSync(`./artifacts/contracts/mocks/MockUniswapV2Factory.sol/MockUniswapV2Factory.json`);
    await network.provider.send("hardhat_setCode", [
      UNISWAP_FACTORY,
      JSON.parse(uniswapFactoryJson).deployedBytecode,
    ]);

    let lusdTokenJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockLUSDToken.sol/MockLUSDToken.json');
    await network.provider.send("hardhat_setCode", [
      LUSD_TOKEN,
      JSON.parse(lusdTokenJson).deployedBytecode,
    ]);

    let borrowerOperationsJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockBorrowerOperations.sol/MockBorrowerOperations.json');
    await network.provider.send("hardhat_setCode", [
      BORROWER_OPERATIONS,
      JSON.parse(borrowerOperationsJson).deployedBytecode,
    ]);
	
    let troveManagerJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockTroveManager.sol/MockTroveManager.json');
    await network.provider.send("hardhat_setCode", [
      TROVE_MANAGER,
      JSON.parse(troveManagerJson).deployedBytecode,
    ]);

    let sortedTrovesJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockSortedTroves.sol/MockSortedTroves.json');
    await network.provider.send("hardhat_setCode", [
      SORTED_TROVES,
      JSON.parse(sortedTrovesJson).deployedBytecode,
    ]);

    let activePoolJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockActivePool.sol/MockActivePool.json');
    await network.provider.send("hardhat_setCode", [
      ACTIVE_POOL,
      JSON.parse(activePoolJson).deployedBytecode,
    ]);

    let defaultPoolJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockDefaultPool.sol/MockDefaultPool.json');
    await network.provider.send("hardhat_setCode", [
      DEFAULT_POOL,
      JSON.parse(defaultPoolJson).deployedBytecode,
    ]);

    let gasPoolJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockGasPool.sol/MockGasPool.json');
    await network.provider.send("hardhat_setCode", [
      GAS_POOL,
      JSON.parse(gasPoolJson).deployedBytecode,
    ]);

    let stabilityPoolJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockStabilityPool.sol/MockStabilityPool.json');
    await network.provider.send("hardhat_setCode", [
      STABILITY_POOL,
      JSON.parse(stabilityPoolJson).deployedBytecode,
    ]);

    let lqtyStakingJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockLQTYStaking.sol/MockLQTYStaking.json');
    await network.provider.send("hardhat_setCode", [
      LQTY_STAKING,
      JSON.parse(lqtyStakingJson).deployedBytecode,
    ]);

    let collSurplusPoolJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockCollSurplusPool.sol/MockCollSurplusPool.json');
    await network.provider.send("hardhat_setCode", [
      COLL_SURPLUS_POOL,
      JSON.parse(collSurplusPoolJson).deployedBytecode,
    ]);

    let priceFeedJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockPriceFeed.sol/MockPriceFeed.json');
    await network.provider.send("hardhat_setCode", [
      PRICE_FEED,
      JSON.parse(priceFeedJson).deployedBytecode,
    ]);

    let lqtyTokenJson = fs.readFileSync('./artifacts/contracts/mocks/mockLiquity/MockLQTYToken.sol/MockLQTYToken.json');
    await network.provider.send("hardhat_setCode", [
      LQTY_TOKEN,
      JSON.parse(lqtyTokenJson).deployedBytecode,
    ]);

}

exports.impersonateCurve = curve
exports.impersonateLiquity = liquity
