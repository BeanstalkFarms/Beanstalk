const fs = require('fs');

function parseAccountStatus(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        
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

        fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), (writeErr) => {
            if (writeErr) {
                callback(writeErr, null);
                return;
            }
            callback(null, 'Account Status JSON has been written successfully');
        });
    });
}

const inputFilePath = "./reseed/data/exports/storage-accounts20330000.json";
const outputFilePath = "./reseed/data/r7-account-status.json";
parseAccountStatus(inputFilePath, outputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
})


// module.exports = parseAccountStatus;
