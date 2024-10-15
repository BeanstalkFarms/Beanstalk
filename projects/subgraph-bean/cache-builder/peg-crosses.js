const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const url = "https://graph.bean.money/bean_eth";
const subgraph = new GraphQLClient(url);

// Gets all unique blocks in which there was either a pool or peg cross.
async function getAllPegCrossBlocks() {
  console.log(`Pulling historical peg cross blocks from ${url}...`);

  const allCrossBlocks = [];

  let nextBlock = 1;
  while (nextBlock) {
    let queryResult = await _getCrossesSince(nextBlock);

    for (const poolCross of queryResult.poolCrosses) {
      if (!allCrossBlocks.includes(poolCross.blockNumber)) {
        allCrossBlocks.push(poolCross.blockNumber);
      }
    }
    for (const beanCross of queryResult.beanCrosses) {
      if (!allCrossBlocks.includes(beanCross.blockNumber)) {
        allCrossBlocks.push(beanCross.blockNumber);
      }
    }

    const maxPoolBlock = queryResult.poolCrosses[999]?.blockNumber;
    const maxBeanBlock = queryResult.beanCrosses[999]?.blockNumber;
    if (!maxPoolBlock && !maxBeanBlock) {
      nextBlock = undefined;
    } else if (maxPoolBlock && !maxBeanBlock) {
      nextBlock = maxPoolBlock;
    } else if (!maxPoolBlock && maxBeanBlock) {
      nextBlock = maxBeanBlock;
    } else {
      nextBlock = Math.min(maxPoolBlock, maxBeanBlock);
    }
  }
  allCrossBlocks.sort();

  const outFile = `${__dirname}/results/PegCrossBlocks_eth.ts`;
  await fs.promises.writeFile(
    outFile,
    `/* This is a generated file */
    
    export const PEG_CROSS_BLOCKS: u32[] = [${allCrossBlocks.join(",")}];
    export const PEG_CROSS_BLOCKS_LAST: u32 = ${allCrossBlocks[allCrossBlocks.length - 1]};
  `
  );
  console.log(`Wrote historical peg cross blocks to ${outFile}`);

  return allCrossBlocks;
}

async function _getCrossesSince(block) {
  return await subgraph.request(gql`
    {
      poolCrosses(where: { blockNumber_gt: ${block}}, first: 1000, orderBy: blockNumber, orderDirection: asc) {
        blockNumber
      }
      beanCrosses(where: { blockNumber_gt: ${block}}, first: 1000, orderBy: blockNumber, orderDirection: asc) {
        blockNumber
      }
    }
  `);
}

getAllPegCrossBlocks();
