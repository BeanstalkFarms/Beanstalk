const fs = require('fs');

function parseFertilizer(inputFilePath, outputFilePath, chunkSize, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        
        const accounts = JSON.parse(data)._balances;
        const result = [];

        for (const fertilizerId in accounts) {
            if (accounts.hasOwnProperty(fertilizerId)) {
                const accountData = accounts[fertilizerId];
                const accountIds = Object.keys(accountData);

                if (accountIds.length > 0) {
                    // Split accounts into chunks of chunkSize
                    for (let i = 0; i < accountIds.length; i += chunkSize) {
                        const accountChunk = accountIds.slice(i, i + chunkSize).map(account => {
                            const { amount, lastBpf } = accountData[account];
                            return [
                                account,
                                parseInt(amount, 16).toString(),
                                parseInt(lastBpf, 16).toString()
                            ];
                        });

                        result.push([
                            parseInt(fertilizerId, 16).toString(),
                            accountChunk
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
            callback(null, 'Fertilizer JSON has been written successfully');
        });
    });
}

const inputFilePath = "./reseed/data/exports/storage-fertilizer20330000.json";
const outputFilePath = "./reseed/data/r5-barn-raise.json";
const chunkSize = 40;
parseFertilizer(inputFilePath, outputFilePath, chunkSize, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

// module.exports = parseFertilizer;
