const fs = require('fs');

function parseAccountStatus(inputFilePath, outputFilePath) {
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
        const accounts = JSON.parse(data);
        const result = [];

        for (const account in accounts) {
            if (accounts.hasOwnProperty(account)) {
                const accountData = accounts[account];
                const stalk = accountData.stalk ? parseInt(accountData.stalk, 16).toString() : "0";
                const mowStatuses = accountData.mowStatuses;
                const tokenAddresses = [];
                const mowStatusArray = [];

                for (const tokenAddress in mowStatuses) {
                    if (mowStatuses.hasOwnProperty(tokenAddress)) {
                        tokenAddresses.push(tokenAddress);
                        const lastStem = mowStatuses[tokenAddress].lastStem;
                        const bdv = mowStatuses[tokenAddress].bdv;
                        mowStatusArray.push([
                            parseInt(lastStem, 16).toString(),
                            parseInt(bdv, 16).toString()
                        ]);
                    }
                }

                result.push([
                    account,
                    stalk,
                    tokenAddresses,
                    mowStatusArray
                ]);
            }
        }

        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        console.log('Account Status JSON has been written successfully');
    } catch (err) {
        console.error('Error:', err);
    }
}

exports.parseAccountStatus = parseAccountStatus;
