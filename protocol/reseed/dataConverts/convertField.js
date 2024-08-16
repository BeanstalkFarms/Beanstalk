const fs = require('fs');

function parseField(inputFilePath, outputFilePath, contractAccounts) {
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
        const accounts = JSON.parse(data);
        const result = [];

        for (const account in accounts) {
            if (accounts.hasOwnProperty(account)) {
                const fields = accounts[account].fields;
                const fieldKeys = Object.keys(fields);

                if (fieldKeys.length > 0) {
                    const field = fields[fieldKeys[0]];
                    const plots = field.plots;
                    const plotIndexes = field.plotIndexes;

                    if (Object.keys(plots).length > 0 && plotIndexes.length > 0) {
                        const plotArray = plotIndexes.map((index, idx) => {
                            const plotKey = Object.keys(plots)[idx];
                            const amount = plots[plotKey];
                            return [parseInt(index, 16).toString(), parseInt(amount, 16).toString()];
                        });
                        // do not include contract accounts
                        if (!contractAccounts.includes(account)) {
                            result.push([account, plotArray]);
                        }
                    }
                }
            }
        }
        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        console.log('Field JSON has been written successfully');
    } catch (err) {
        console.error('Error:', err);
    }
}

exports.parseField = parseField;
