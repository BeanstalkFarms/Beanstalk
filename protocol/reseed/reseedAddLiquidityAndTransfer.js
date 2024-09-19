const {
  MAX_UINT256,
  L2_WETH,
  L2_WSTETH,
  L2_WEETH,
  L2_WBTC,
  L2_USDC,
  L2_USDT
} = require("../test/hardhat/utils/constants.js");
const { to18, to6, toX } = require("../test/hardhat/utils/helpers.js");
const { impersonateToken } = require("../scripts/impersonate.js");
const fs = require("fs");

const WellAddresses = [
  "0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB", // BEAN/WETH
  "0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8", // BEAN/WstETH
  "0xBEA00865405A02215B44eaADB853d0d2192Fc29D", // BEAN/WEETH
  "0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA", // BEAN/WBTC
  "0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279", // BEAN/USDC
  "0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b" // BEAN/USDT
];

const NonBeanToken = [
  L2_WETH, // WETH
  L2_WSTETH, // WstETH
  L2_WEETH, // WEETH
  L2_WBTC, // WBTC
  L2_USDC, // USDC
  L2_USDT // USDT
];

async function setBalance(
  contract, // token contract address
  account, // account address
  amount, // amount to set
  slot // storage slot to set
) {
  const index = ethers.utils.solidityKeccak256(["uint256", "uint256"], [account, slot]);
  const balance = ethers.utils.hexlify(
    ethers.utils.zeroPad(ethers.BigNumber.from(amount).toHexString(), 32)
  );
  await hre.network.provider.send("hardhat_setStorageAt", [contract, index, balance]);
}

async function reseedAddLiquidityAndTransfer(account, L2Beanstalk, mock = true, verbose = true) {
  const INIT_WELL_BALANCES = "./reseed/data/r2/L2_well_balances.json";
  [balancesInBeanEthWell, balancesInBeanWstEthWell, balancesInBeanStableWell] = JSON.parse(
    await fs.readFileSync(INIT_WELL_BALANCES)
  );

  const slots = [
    51, // WETH
    1, // wstETH
    51, // WEETH
    51, // WBTC
    9, // USDC
    51 // USDT
  ];

  const nonBeanAmounts = [
    to18("20.6"), // BEAN/WETH
    to18("2556"), // BEAN/WstETH
    to6("0"), // to18("16"), // BEAN/WEEETH
    toX("0", 8), // BEAN/WBTC (8 decimals)
    to6("206686.240460"), // to6("190000"), // BEAN/USDC
    to6("0") // to6("190000") // BEAN/USDT
  ];

  const beanAmounts = [
    to6("107380.655868"), // BEAN/WETH
    to6("14544578.478380"), // BEAN/WstETH
    to6("0"), // to6("100000"), // BEAN/WEEETH
    to6("0"), // to6("1000000"), // BEAN/WBTC
    to6("83855.245277"), // BEAN/USDC
    to6("0") // to6("1000000") // BEAN/USDT
  ];
  console.log("-----------------------------------");
  console.log("add liquidity to wells and transfers to l2 beanstalk.\n");
  const beanAddress = "0xBEA0005B8599265D41256905A9B3073D397812E4";
  await impersonateToken(beanAddress, 6);
  const bean = await ethers.getContractAt("MockToken", beanAddress);

  // add liquidity and transfer to L2 Beanstalk:
  for (let i = 0; i < WellAddresses.length; i++) {
    const well = await ethers.getContractAt("IWell", WellAddresses[i], account);
    const token = await ethers.getContractAt("IERC20", NonBeanToken[i], account);

    if (mock) {
      console.log(`Minting tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
      await setBalance(NonBeanToken[i], account.address, nonBeanAmounts[i], slots[i]);
      await setBalance(beanAddress, account.address, beanAmounts[i], 0); // storage slot 0 for MockToken
    }

    console.log(`Approving tokens for ${WellAddresses[i]} and ${NonBeanToken[i]}`);
    await token.connect(account).approve(well.address, MAX_UINT256);
    await bean.connect(account).approve(well.address, MAX_UINT256);
    // add liquidity to well, to L2 Beanstalk:
    console.log(
      `Adding liquidity to ${WellAddresses[i]} and performing an update to the well pump.`
    );
    await well
      .connect(account)
      .addLiquidity([beanAmounts[i], nonBeanAmounts[i]], 0, L2Beanstalk, MAX_UINT256);
    // perform a 0 liq addition to update the well pumps and avoid "NotInitialized" error.
    await well.connect(account).addLiquidity([0, 0], 0, L2Beanstalk, MAX_UINT256);
  }
}

exports.reseedAddLiquidityAndTransfer = reseedAddLiquidityAndTransfer;
