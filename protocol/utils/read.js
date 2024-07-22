const fs = require('fs');

async function readPrune() {
    const contents = await fs.readFileSync('contracts/C.sol', 'utf-8');
    let num = contents.split('INITIAL_HAIRCUT = ')[1].split(';')[0]
    num = parseFloat(num).toString()
    return num
}

// Helper function to recursively convert string numbers to integers
function convertToInt(value) {
    // Check if the value is a valid address format
    const isAddress = /^0x[a-fA-F0-9]/.test(value);
    if (Array.isArray(value)) {
      return value.map(convertToInt);
    } else if (typeof value === 'string' && !isAddress && !isNaN(value)) {
      return parseInt(value, 10);
    }
    return value;
  }

exports.readPrune = readPrune
exports.convertToInt = convertToInt