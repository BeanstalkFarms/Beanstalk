const fs = require('fs');

function parseInternalBalances(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        
        const accounts = JSON.parse(data);
        const result = [];

        for (const account in accounts) {
            if (accounts.hasOwnProperty(account)) {
                const internalBalances = accounts[account].internalTokenBalance;
                for (const tokenAddress in internalBalances) {
                    if (internalBalances.hasOwnProperty(tokenAddress)) {
                        const balance = internalBalances[tokenAddress];
                        result.push([
                            account,
                            tokenAddress,
                            parseInt(balance, 16)
                        ]);
                    }
                }
            }
        }

        fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), (writeErr) => {
            if (writeErr) {
                callback(writeErr, null);
                return;
            }
            callback(null, 'File has been written successfully');
        });
    });
}

const inputFilePath = "./reseed/converts/storage-accounts20330000.json";
const outputFilePath = './reseed/converts/outputs/internal-balances.json';
parseInternalBalances(inputFilePath, outputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

module.exports = parseInternalBalances;
