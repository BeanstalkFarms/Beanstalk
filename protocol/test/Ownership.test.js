const { expect, use } = require("chai");
const { waffleChai } = require("@ethereum-waffle/chai");
use(waffleChai);
const { deploy } = require("../scripts/deploy.js");
const { ZERO_ADDRESS } = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { getAllBeanstalkContracts } = require("../utils/contracts");

let snapshotId;

describe("Ownership", function () {
  let contracts;
  let provider;
  before(async function () {
    contracts = await deploy((verbose = false), (mock = true), (reset = true));
    [owner, user, user2] = await ethers.getSigners();

    provider = ethers.getDefaultProvider();

    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    const SiloToken = await ethers.getContractFactory("MockToken");
    this.siloToken = await SiloToken.deploy("Silo", "SILO");
    await this.siloToken.deployed();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("ownership", async function () {
    describe("transfer", async function () {
      it("reverts if not owner", async function () {
        await expect(beanstalk.connect(user2).transferOwnership(user2.address)).to.be.revertedWith(
          "LibDiamond: Must be contract owner"
        );
      });

      it("transfers owner", async function () {
        this.result = await beanstalk.connect(owner).transferOwnership(user2.address);
        expect(await beanstalk.ownerCandidate()).to.be.equal(user2.address);
        expect(await beanstalk.owner()).to.be.equal(ownerAddress);
      });
    });

    describe("claim", async function () {
      it("reverts if not candidate", async function () {
        await expect(beanstalk.connect(user2).claimOwnership()).to.be.revertedWith(
          "Ownership: Not candidate"
        );
      });

      it("claims ownership", async function () {
        await beanstalk.connect(owner).transferOwnership(user2.address);
        this.result = beanstalk.connect(user2).claimOwnership();

        expect(await beanstalk.ownerCandidate()).to.be.equal(ZERO_ADDRESS);
        expect(await beanstalk.owner()).to.be.equal(user2.address);
        await expect(this.result)
          .to.emit(beanstalk, "OwnershipTransferred")
          .withArgs(ownerAddress, user2.address);
      });
    });
  });

  describe("pause", async function () {
    it("reverts if not owner", async function () {
      await expect(beanstalk.connect(user2).pause()).to.be.revertedWith(
        "LibDiamond: Must be contract or owner"
      );
    });

    it("reverts if paused", async function () {
      this.result = await beanstalk.connect(owner).pause();
      await expect(beanstalk.connect(owner).pause()).to.be.revertedWith("Pause: already paused.");
    });

    it("pauses", async function () {
      this.result = await beanstalk.connect(owner).pause();
      expect(await beanstalk.paused()).to.equal(true);
      await expect(this.result).to.emit(beanstalk, "Pause");
    });
  });

  describe("unpause", async function () {
    it("reverts if not owner", async function () {
      await expect(beanstalk.connect(user2).unpause()).to.be.revertedWith(
        "LibDiamond: Must be contract or owner"
      );
    });

    it("reverts if not paused", async function () {
      await expect(beanstalk.connect(owner).unpause()).to.be.revertedWith("Pause: not paused.");
    });

    it("unpauses", async function () {
      await beanstalk.connect(owner).pause();
      this.result = await beanstalk.connect(owner).unpause();
      expect(await beanstalk.paused()).to.equal(false);
      await expect(this.result).to.emit(beanstalk, "Unpause");
    });
  });
});
