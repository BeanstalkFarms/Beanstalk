const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { readPrune, toBN } = require("../utils");
const { getBeanstalk } = require("../utils/contracts.js");
const { EXTERNAL } = require("./utils/balances.js");
const { BEAN, UNRIPE_LP, UNRIPE_BEAN, ZERO_BYTES } = require("./utils/constants");
const { to18, toStalk, to6 } = require("./utils/helpers.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;

let pru;

function pruneToSeeds(value, seeds = 2) {
  return prune(value).mul(seeds);
}

function pruneToStalk(value) {
  return prune(value).mul(toBN("10000"));
}

function prune(value) {
  return toBN(value).mul(toBN(pru)).div(to18("1"));
}

describe("Silo Enroot", function () {
  before(async function () {
    pru = await readPrune();
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();

    this.siloToken2 = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken2.deployed();

    await mockBeanstalk.mockWhitelistToken(
      this.siloToken.address,
      mockBeanstalk.interface.getSighash("mockBDV(uint256 amount)"),
      "10000",
      "1"
    );

    await mockBeanstalk.siloSunrise(0);
    await this.siloToken.connect(user).approve(beanstalk.address, "100000000000");
    await this.siloToken.connect(user2).approve(beanstalk.address, "100000000000");
    await this.siloToken.mint(user.address, "10000");
    await this.siloToken.mint(user2.address, "10000");
    await this.siloToken2.connect(user).approve(beanstalk.address, "100000000000");
    await this.siloToken2.mint(user.address, "10000");

    await this.siloToken.connect(owner).approve(beanstalk.address, to18("10000"));
    await this.siloToken.mint(ownerAddress, to18("10000"));

    // Needed to appease invariants when underlying asset of urBean != Bean.
    await mockBeanstalk.removeWhitelistStatus(BEAN);

    this.unripeBeans = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    await this.unripeBeans.connect(user).mint(user.address, to6("10000"));
    await this.unripeBeans.connect(user).approve(beanstalk.address, to18("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, this.siloToken.address, ZERO_BYTES);
    await mockBeanstalk
      .connect(owner)
      .addUnderlying(UNRIPE_BEAN, to6("10000").mul(toBN(pru)).div(to18("1")));

    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.connect(user).mint(user.address, to6("10000"));
    await this.unripeLP.connect(user).approve(beanstalk.address, to18("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, this.siloToken.address, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, toBN(pru).mul(toBN("10000")));

    season = await beanstalk.season();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Unripe Bean Removal", async function () {
    describe("All but 1", async function () {
      beforeEach(async function () {
        // 158328 * 0.185564685220298701 ~= 29380.085
        // 158327 * 0.185564685220298701 ~= 29379.899
        // floor(29380.085) - floor(29379.899) = 1

        mockBeanstalk.deployStemsUpgrade();

        // call sunrise twice to avoid germination error.
        // note that `mockUnripeBeanDeposit` increments correctly,
        // and the error is only thrown due to the stem being a germinating stem.
        await mockBeanstalk.siloSunrise(0);
        await mockBeanstalk.siloSunrise(0);

        this.stem = 0;
        await mockBeanstalk
          .connect(user)
          .depositAtStemAndBdv(UNRIPE_BEAN, "158328", this.stem, "29380", 0);

        await beanstalk.connect(user).withdrawDeposit(UNRIPE_BEAN, this.stem, "158327", EXTERNAL);
      });
      it("should remove most of the deposit", async function () {
        const deposit = await beanstalk
          .connect(user)
          .getDeposit(user.address, UNRIPE_BEAN, this.stem);
        // bdv != amt due to bdv removals rounding up. acceptable.
        expect(deposit[0]).to.equal("1"); // amt
        expect(deposit[1]).to.equal("0"); // bdv
      });

      it("removes all stalk", async function () {
        const stalk = await beanstalk.balanceOfStalk(user.address);
        expect(stalk).to.equal("0");
      });
    });
  });
});
