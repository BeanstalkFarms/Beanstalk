const fs = require('fs');

function parseDeposits(inputFilePath, outputFilePath) {
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
        const accounts = JSON.parse(data);
        const result = [];

        for (const account in accounts) {
            if (accounts.hasOwnProperty(account)) {
                const deposits = accounts[account].deposits;
                const depositIds = Object.keys(deposits);

                if (depositIds.length > 0) {
                    const depositArray = depositIds.map(depositId => {
                        const { amount, bdv } = deposits[depositId];
                        return [
                            depositId,
                            parseInt(amount, 16).toString(),
                            parseInt(bdv, 16).toString()
                        ];
                    });

                    result.push([account, depositArray]);
                }
            }
        }

        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        console.log('Deposits JSON has been written successfully');
    } catch (err) {
        console.error('Error:', err);
    }
}

exports.parseDeposits = parseDeposits;
