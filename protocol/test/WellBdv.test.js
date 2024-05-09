const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { to18, to6 } = require("./utils/helpers.js");
const { getBeanstalk } = require("../utils/contracts.js");
const { whitelistWell, deployMockWellWithMockPump } = require("../utils/well.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");

let user, user2, owner;

let snapshotId;

describe("Well BDV", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await this.pump.setInstantaneousReserves(this.well.address, [to18("1"), to18("1")]);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("get BDV at 1:1", async function () {
    expect(await beanstalk.wellBdv(this.well.address, to6("1000000"))).to.be.within(
      "1999999",
      "2000001"
    );
    expect(await beanstalk.wellBdv(this.well.address, to6("1000000"))).to.be.within(
      "1999999",
      "2000001"
    );
    expect(await beanstalk.bdv(this.well.address, to6("1000000"))).to.be.within(
      "1999999",
      "2000001"
    );
  });

  it("Gets BDV at 4:1", async function () {
    await this.pump.setInstantaneousReserves(this.well.address, [to18("4"), to18("1")]);
    expect(await beanstalk.bdv(this.well.address, to6("1000000"))).to.be.within(
      "3999999",
      "4000001"
    );
  });

  it("Gets BDV at 1:4", async function () {
    await this.pump.setInstantaneousReserves(this.well.address, [to18("1"), to18("4")]);
    expect(await beanstalk.bdv(this.well.address, to6("1000000"))).to.be.within(
      "999999",
      "1000001"
    );
  });

  it("Fails if balance too low", async function () {
    await this.pump.setInstantaneousReserves(this.well.address, [to6("1"), to18("1")]);
    await expect(beanstalk.bdv(this.well.address, to6("1000000"))).to.be.revertedWith(
      "Silo: Well Bean balance below min"
    );
  });
});
