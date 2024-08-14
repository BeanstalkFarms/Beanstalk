const fs = require("fs");
const readline = require("readline");

async function readPrune() {
  const contents = await fs.readFileSync("contracts/C.sol", "utf-8");
  let num = contents.split("INITIAL_HAIRCUT = ")[1].split(";")[0];
  num = parseFloat(num).toString();
  return num;
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

// Count entries recursively
function countEntries(item) {
  if (Array.isArray(item)) {
    return item.reduce((sum, subItem) => sum + countEntries(subItem), 0);
  } else {
    return 1;
  }
}

// in the EVM, setting a zero value to a non-zero value costs 20,000 gas.
// assuming a transaction gas target of 20m, this means that we can fit
// 1000 storage changes in a single transaction. In practice, we aim for a conservative
// 800 storage slots to account for logic.
function splitEntriesIntoChunksOptimized(data, targetEntriesPerChunk) {
  const chunks = [];
  let currentChunk = [];
  let currentChunkEntries = 0;

  for (const item of data) {
    const itemEntries = countEntries(item);

    if (currentChunkEntries + itemEntries > targetEntriesPerChunk && currentChunk.length > 0) {
      // This item would exceed the target, so start a new chunk
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkEntries = 0;
    }

    currentChunk.push(item);
    currentChunkEntries += itemEntries;
  }

  // Add any remaining entries to the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function updateProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const progressBarLength = 30;
  let filledLength = Math.round((progressBarLength * current) / total);
  if (filledLength > progressBarLength) filledLength = progressBarLength;
  const progressBar = "█".repeat(filledLength) + "░".repeat(progressBarLength - filledLength);

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write("\n"); // end the line
  process.stdout.write(`Processing: [${progressBar}] ${percentage}% | Chunk ${current}/${total}`);
}

exports.readPrune = readPrune;
exports.splitEntriesIntoChunks = splitEntriesIntoChunks;
exports.splitEntriesIntoChunksOptimized = splitEntriesIntoChunksOptimized;
exports.updateProgress = updateProgress;
