var fs = require('fs');


const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const LUSD_TOKEN = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const TROVE_MANAGER = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const BORROWER_OPERATIONS = "0x24179CD81c9e782A4096035f7eC97fB8B783e007";
const SORTED_TROVES = "0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6";

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

}

exports.impersonateCurve = curve
