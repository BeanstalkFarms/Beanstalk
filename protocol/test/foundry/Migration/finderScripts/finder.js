const fs = require("fs");
const { ethers } = require("ethers");
const { BigNumber } = require("ethers");


function getValueFromJSON(jsonObj, searchPath) {
    let result = jsonObj;
    const keys = searchPath.split('.');

    for (const key of keys) {
        if (result && typeof result === 'object' && result.hasOwnProperty(key)) {
            result = result[key];
        } else {
            // If any part of the path is not found, return 0x0
            return ethers.utils.hexlify(ethers.BigNumber.from(0));
        }
    }

    if (Array.isArray(result)) {
        // If the result is an array, encode it using ethers' ABI coder
        return ethers.utils.defaultAbiCoder.encode(['uint256[]'], [result]);
    } else {
        // Otherwise, convert it to a BigNumber and hexlify it
        return ethers.utils.hexlify(ethers.BigNumber.from(result));
    }
}

// Get the command line arguments for JSON file path and the key to search
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const searchKey = args[1];
// Load the JSON file
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
// Search for the key in the JSON
let value = getValueFromJSON(jsonData, searchKey);
// clean any spaces, newlines, etc.
value = value.replace(/\s/g, '');
console.log(value);
