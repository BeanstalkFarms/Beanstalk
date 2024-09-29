const fs = require("fs");
const { ethers } = require("ethers");

const whitelistedTokens = [
  "0xBEA0005B8599265D41256905A9B3073D397812E4", // BEAN
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543", // urBEAN
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788", // urLP
  "0xBEA00AA912aEc233303C9455f0fc2D438ac929f5", // BEAN/WETH
  "0xbea00BB0102b5F3C351a08c47C730fD0E9fD9870", // BEAN/WstETH
  "0xBEA00Cc5152e597eAfBA470453932BdC5fC3C8A1", // BEAN/WEETH
  "0xBeA00DD4B4D7cA2b4B49dE3D2A51189D22c1f31e", // BEAN/WBTC
  "0xbEA00EeEC3A0DC145c4dC5008f44212771a4704d", // BEAN/USDC
  "0xBea00fF64E706B16bB5485B0aDe41d09DC95A9A9" // BEAN/USDT
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
