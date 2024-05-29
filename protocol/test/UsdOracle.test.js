const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { getBeanstalk } = require("../utils");
const { USDC } = require("./utils/constants.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");

describe("USD Oracle", function () {
  before(async function () {
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(contracts.beanstalkDiamond.address);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("Reverts if not accepted token", async function () {
    expect(await mockBeanstalk.getUsdPrice(USDC)).to.be.equal(0);
  });
});
