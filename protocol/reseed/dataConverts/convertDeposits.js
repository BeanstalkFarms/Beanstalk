const fs = require('fs');

function parseDeposits(inputFilePath, outputFilePath, chunkSize, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }

        const accounts = JSON.parse(data);
        const result = [];

        for (const account in accounts) {
            if (accounts.hasOwnProperty(account)) {
                const deposits = accounts[account].deposits;
                const depositIds = Object.keys(deposits);

                if (depositIds.length > 0) {
                    // Split deposits into chunks of chunkSize
                    for (let i = 0; i < depositIds.length; i += chunkSize) {
                        const depositChunk = depositIds.slice(i, i + chunkSize).map(depositId => {
                            const { amount, bdv } = deposits[depositId];
                            return [
                                depositId,
                                parseInt(amount, 16).toString(),
                                parseInt(bdv, 16).toString()
                            ];
                        });

                        result.push([
                            account,
                            depositChunk
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
            callback(null, 'Deposits JSON has been written successfully');
        });
    });
}

const inputFilePath = "./reseed/data/exports/storage-accounts20330000.json";
const outputFilePath = "./reseed/data/r6-deposits.json";
const chunkSize = 40;
parseDeposits(inputFilePath, outputFilePath, chunkSize, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

// module.exports = parseDeposits;
