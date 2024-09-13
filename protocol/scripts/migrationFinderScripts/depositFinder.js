const fs = require('fs');
const { ethers } = require('ethers');

const whitelistedTokens = [
    '0xBEA0005B8599265D41256905A9B3073D397812E4', // BEAN
    '0x1BEA054dddBca12889e07B3E076f511Bf1d27543', // urBEAN
    '0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788', // urLP
    "0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB", // BEAN/WETH
    "0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8", // BEAN/WstETH
    "0xBEA00865405A02215B44eaADB853d0d2192Fc29D", // BEAN/WEETH
    "0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA", // BEAN/WBTC
    "0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279", // BEAN/USDC
    "0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b" // BEAN/USDT
];

function findTokenDepositIds(jsonFilePath, account) {
    // Load the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    // Check if the account exists in the JSON data
    if (!jsonData.hasOwnProperty(account)) {
        console.error(`Account ${account} not found in the JSON file.`);
        return null;
    }

    const deposits = jsonData[account].deposits;
    const depositIdList = jsonData[account].depositIdList || {};

    // Array to hold the TokenDepositId structs
    let tokenDepositIds = [];

    // Process each token in the whitelistedTokens array
    for (const token of whitelistedTokens) {
        if (depositIdList.hasOwnProperty(token)) {
            const depositIds = depositIdList[token];
            const tokenDeposits = depositIds.map(depositId => {
                const depositInfo = deposits[ethers.BigNumber.from(depositId).toString()];
                return {
                    amount: ethers.BigNumber.from(depositInfo.amount),
                    bdv: ethers.BigNumber.from(depositInfo.bdv)
                };
            });

            // Create the TokenDepositId struct with deposits
            tokenDepositIds.push({
                token: token,
                depositIds: depositIds.map(id => ethers.BigNumber.from(id)),
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
            'tuple(address token, uint256[] depositIds, tuple(uint256 amount, uint256 bdv)[] tokenDeposits)[]'
        ],
        [tokenDepositIds]
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
