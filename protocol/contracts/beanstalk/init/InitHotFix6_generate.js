const fs = require('fs');

// Read and parse the JSON file
fs.readFile('InitHotFix6Data.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    try {
        const jsonData = JSON.parse(data);

        // Loop through each object in the array
        jsonData.forEach(item => {
            const address = item.account;
            const stalk = item.accountDiscrepancy.stalk;
            const roots = item.accountDiscrepancy.roots;

            // Print the adjustAccount call with filled-in data
            console.log(`adjustAccount(address(${address}), ${stalk}, ${roots});`);
        });
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});