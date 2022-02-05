const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db'

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

async function bean() {
    let tokenJson = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);

    await network.provider.send("hardhat_setCode", [
      BEAN,
      JSON.parse(tokenJson).deployedBytecode,
    ]);
    return BEAN;
}

exports.impersonateRouter = router
exports.impersonateBean = bean