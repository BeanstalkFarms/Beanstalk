const fs = require('fs');

function parseFertilizer(inputFilePath, outputFilePath, chunkSize) {
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
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

        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        console.log('Fertilizer JSON has been written successfully');
    } catch (err) {
        console.error('Error:', err);
    }
}

exports.parseFertilizer = parseFertilizer;
