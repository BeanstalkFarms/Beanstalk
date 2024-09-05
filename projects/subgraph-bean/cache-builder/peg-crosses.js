const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const subgraph = new GraphQLClient("https://graph.bean.money/bean");

// Gets all unique blocks in which there was either a pool or peg cross.
async function getAllPegCrossBlocks() {
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

  await fs.promises.appendFile(
    `${__dirname}/results/PegCrossBlocks2.ts`,
    `export const PEG_CROSS_BLOCKS: u32[] = [${allCrossBlocks.join(",")}];
    export const PEG_CROSS_BLOCKS_LAST: u32 = ${allCrossBlocks[allCrossBlocks.length - 1]};
  `
  );

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
