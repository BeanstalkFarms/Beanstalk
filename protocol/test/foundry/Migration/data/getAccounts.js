const fs = require('fs');

// Define the paths as variables
const jsonFilePath = './reseed/data/exports/storage-accounts20577510.json'; // Replace with your actual JSON file path
const outputFilePath = './test/foundry/Migration/data/accounts.txt'; // Replace with your desired output file path

function extractAccountAddresses(jsonFilePath, outputFilePath) {
    try {
        // Load the JSON file
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

        // Extract all the account addresses (keys of the main object)
        const accountAddresses = Object.keys(jsonData);

        // Write the account addresses to a text file, each address on a new line
        fs.writeFileSync(outputFilePath, accountAddresses.join('\n'), 'utf8');

        console.log(`Successfully written ${accountAddresses.length} account addresses to ${outputFilePath}`);
    } catch (error) {
        console.error(`Error processing the JSON file: ${error.message}`);
    }
}

// Run the function
extractAccountAddresses(jsonFilePath, outputFilePath);
