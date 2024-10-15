const fs = require("fs");
const { ethers } = require("ethers");

const whitelistedTokens = [
  "0xBEA0005B8599265D41256905A9B3073D397812E4", // BEAN
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543", // urBEAN
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788", // urLP
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce", // BEAN/WETH
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F", // BEAN/WstETH
  "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c", // BEAN/WEETH
  "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c", // BEAN/WBTC
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7", // BEAN/USDC
  "0xbEA00fF437ca7E8354B174339643B4d1814bED33" // BEAN/USDT
];

function findTokenDepositIds(jsonFilePath, account) {
  // Load the JSON file
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

  //make sure account passed in is checksummed
  if (account.toLowerCase() == account) {
    account = ethers.utils.getAddress(account);
  }

  // Check if the account exists in the JSON data
  if (!jsonData.hasOwnProperty(account)) {
    return "0x"; // indicate to caller that there are no deposits
  }

  const deposits = jsonData[account].deposits;
  const depositIdList = jsonData[account].depositIdList || {};

  // Array to hold the TokenDepositId structs
  let tokenDepositIds = [];

  // Arrays to hold all deposit IDs, amounts, and BDVs in order
  let allDepositIds = [];
  let allAmounts = [];
  let allBdvs = [];

  // Process each token in the whitelistedTokens array
  for (const token of whitelistedTokens) {
    if (depositIdList.hasOwnProperty(token)) {
      const depositIds = depositIdList[token];
      const tokenDeposits = depositIds.map((depositId) => {
        const depositInfo = deposits[ethers.BigNumber.from(depositId).toString()];
        // Add to the all* arrays
        allDepositIds.push(ethers.BigNumber.from(depositId));
        allAmounts.push(ethers.BigNumber.from(depositInfo.amount));
        allBdvs.push(ethers.BigNumber.from(depositInfo.bdv));
        return {
          amount: ethers.BigNumber.from(depositInfo.amount),
          bdv: ethers.BigNumber.from(depositInfo.bdv)
        };
      });

      // Create the TokenDepositId struct with deposits
      tokenDepositIds.push({
        token: token,
        depositIds: depositIds.map((id) => ethers.BigNumber.from(id)),
        tokenDeposits: tokenDeposits
      });
    } else {
      // Create the TokenDepositId struct with no deposits
      tokenDepositIds.push({
        token: token,
        depositIds: [],
        tokenDeposits: []
      });
    }
  }

  // ABI encode the array of TokenDepositId structs
  const encodedData = ethers.utils.defaultAbiCoder.encode(
    [
      "tuple(address token, uint256[] depositIds, tuple(uint256 amount, uint256 bdv)[] tokenDeposits)[]",
      "uint256[]",
      "uint256[]",
      "uint256[]"
    ],
    [tokenDepositIds, allDepositIds, allAmounts, allBdvs]
  );

  return encodedData;
}

// Get the command line arguments
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const account = args[1];

// Run the function and output the result
const encodedTokenDepositIds = findTokenDepositIds(jsonFilePath, account);
if (encodedTokenDepositIds) {
  console.log(encodedTokenDepositIds);
}
