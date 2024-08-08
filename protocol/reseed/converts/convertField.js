const fs = require('fs');

function parseFieldFromStorageAccounts(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        
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

                        result.push([account, plotArray]);
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
const outputFilePath = "./reseed/converts/outputs/r4-field.json";
parseFieldFromStorageAccounts(inputFilePath, outputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

// module.exports = parseFieldFromStorageAccounts;
