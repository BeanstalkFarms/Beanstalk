const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parseTokens(inputFilePath, outputFilePaths) {
  try {
    // Read the input file
    const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

    // Extract the initial supply from the "beanstalk" section
    const L2_initial_supply = [
      data.beanstalk.beans,
      data.beanstalk.unripeBeans,
      data.beanstalk.unripeLp
    ];

    // Extract the well balances from the "pools" section
    const L2_well_balances = [
      [data.pools.beanweth.bean, data.pools.beanweth.weth],
      [data.pools.beanwsteth.bean, data.pools.beanwsteth.wsteth],
      [data.pools.bean3crv.bean, data.pools.bean3crv.usdc],
    ];

    // Write the JSON files to the specified output paths
    fs.writeFileSync(outputFilePaths.L2_initial_supply, JSON.stringify(L2_initial_supply, null, 2));
    fs.writeFileSync(outputFilePaths.L2_well_balances, JSON.stringify(L2_well_balances, null, 2));

    console.log("Token Reserves and Supplies JSONs have been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseTokens = parseTokens;
