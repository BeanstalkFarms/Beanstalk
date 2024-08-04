const fs = require('fs');

async function readPrune() {
    const contents = await fs.readFileSync('contracts/C.sol', 'utf-8');
    let num = contents.split('INITIAL_HAIRCUT = ')[1].split(';')[0]
    num = parseFloat(num).toString()
    return num
}

function splitEntriesIntoChunks(entries, chunkSize) {
    const chunks = [];
    // Calculate the number of chunks
    const numChunks = Math.ceil(entries.length / chunkSize);
    // Loop through the entries and create chunks
    for (let i = 0; i < numChunks; i++) {
      const chunk = entries.slice(i * chunkSize, (i + 1) * chunkSize);
      chunks.push(chunk);
    }
    return chunks;
}

exports.readPrune = readPrune
exports.splitEntriesIntoChunks = splitEntriesIntoChunks