const fs = require('fs');

function parseFertilizer(inputFilePath, outputFilePath) {
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
        const accounts = JSON.parse(data)._balances;
        const result = [];

        for (const fertilizerId in accounts) {
            if (accounts.hasOwnProperty(fertilizerId)) {
                const accountData = accounts[fertilizerId];
                const accountIds = Object.keys(accountData);

                if (accountIds.length > 0) {
                    const accountArray = accountIds.map(account => {
                        const { amount, lastBpf } = accountData[account];
                        return [
                            account,
                            parseInt(amount, 16).toString(),
                            parseInt(lastBpf, 16).toString()
                        ];
                    });

                    result.push([
                        parseInt(fertilizerId, 16).toString(),
                        accountArray
                    ]);
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
