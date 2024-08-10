const fs = require('fs');

function parseDeposits(inputFilePath, outputFilePath, callback) {
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
                const depositArray = [];

                for (const depositId in deposits) {
                    if (deposits.hasOwnProperty(depositId)) {
                        const { amount, bdv } = deposits[depositId];
                        depositArray.push([
                            depositId,
                            parseInt(amount, 16).toString(),
                            parseInt(bdv, 16).toString()
                        ]);
                    }
                }

                if (depositArray.length > 0) {
                    result.push([
                        account,
                        depositArray
                    ]);
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

const inputFilePath = "./reseed/data/exports/storage-accounts20330000.json";
const outputFilePath = "./reseed/data/r6-deposits.json";
parseDeposits(inputFilePath, outputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
})

// module.exports = parseDeposits;
