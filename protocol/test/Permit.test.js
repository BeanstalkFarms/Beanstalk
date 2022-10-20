const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;
const selector = "0x12345678";

describe("Permit", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.permit = await ethers.getContractAt(
      "MockPermitFacet",
      this.diamond.address
    );
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("should return 0 after initialization", async function () {
    expect(await this.permit.nonces(selector, userAddress)).to.eq(0);
  });

  it("should use nonce", async function () {
    await this.permit.connect(user).useNonce(selector);
    expect(await this.permit.nonces(selector, userAddress)).to.eq(1);
    await this.permit.connect(user2).useNonce(selector);
    expect(await this.permit.nonces(selector, userAddress)).to.eq(1);
    await this.permit.connect(user).useNonce(selector);
    expect(await this.permit.nonces(selector, userAddress)).to.eq(2);
  });
});
