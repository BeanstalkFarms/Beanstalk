const { diamond } = require("./diamond.js")

/**
 * @notice deploys a new beanstalk. Should be on an L2.
 */
async function reseed2(account) {
  console.log('-----------------------------------')
  console.log('reseed2: Deploy new beanstalk.\n')
  const [beanstalkDiamond, diamondCut] = await diamond.deploy({
    diamondName: "BeanstalkDiamond",
    initDiamond: initDiamondArg,
    facets: facetsAndNames,
    owner: account,
    args: [],
    verbose: verbose,
    impersonate: mock && reset
  });
  await console.log('-----------------------------------')
}
exports.reseed2 = reseed2