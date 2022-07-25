const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { EXTERNAL } = require("./utils/balances.js");

let owner;
let users;
let user;
let user2;
let user3;
let user4;
let user5;

let snapshotId;

let data1;
let leafNodes1;
let merkleTree1;

let data2;
let leafNodes2;
let merkleTree2;

const generateRandomNumber = (min, max) => {
  const rand = min + Math.random() * (max - min);
  return Math.round(rand * 1000000) / 1000000;
};

const initializeMerkleTree = async () => {
  users = [user, user2, user3, user4, user5];

  data1 = users.map((user) => ({
    user,
    amount: ethers.utils.parseEther(
      generateRandomNumber(100, 10000).toString()
    ),
  }));
  leafNodes1 = data1.map((item) =>
    ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [item.user.address, item.amount]
    )
  );
  merkleTree1 = new MerkleTree(leafNodes1, keccak256, {
    sortPairs: true,
  });

  data2 = users.map((user) => ({
    user,
    amount: ethers.utils.parseEther(
      generateRandomNumber(100, 10000).toString()
    ),
  }));
  leafNodes2 = data2.map((item) =>
    ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [item.user.address, item.amount]
    )
  );
  merkleTree2 = new MerkleTree(leafNodes2, keccak256, {
    sortPairs: true,
  });
};

describe("UnripeClaim", function () {
  before(async function () {
    [owner, user, user2, user3, user4, user5] = await ethers.getSigners();
    const contracts = await deploy("Test", false, true);
    this.diamond = contracts.beanstalkDiamond;
    this.unripeClaim = await ethers.getContractAt(
      "MockUnripeFacet",
      this.diamond.address
    );

    this.unripeToken1 = await ethers.getContractFactory("MockToken");
    this.unripeToken1 = await this.unripeToken1.deploy("UnripeToken1", "UT1");
    await this.unripeToken1.deployed();

    this.unripeToken2 = await ethers.getContractFactory("MockToken");
    this.unripeToken2 = await this.unripeToken2.deploy("UnripeToken2", "UT2");
    await this.unripeToken2.deployed();

    this.unripeToken1.mint(
      this.diamond.address,
      ethers.utils.parseEther("100000")
    );
    this.unripeToken2.mint(
      this.diamond.address,
      ethers.utils.parseEther("100000")
    );

    await initializeMerkleTree();

    const rootHash1 = merkleTree1.getRoot();
    await this.unripeClaim.setMerkleRootE(this.unripeToken1.address, rootHash1);

    const rootHash2 = merkleTree2.getRoot();
    await this.unripeClaim.setMerkleRootE(this.unripeToken2.address, rootHash2);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it("claim unripe token", async function () {
    const user = data1[0];
    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [user.user.address, user.amount]
    );
    const proof = merkleTree1.getHexProof(leaf);

    const beforeBalance = await this.unripeToken1.balanceOf(user.user.address);
    const tx = await this.unripeClaim
      .connect(user.user)
      .pick(this.unripeToken1.address, user.amount, proof, EXTERNAL);
    const afterBalance = await this.unripeToken1.balanceOf(user.user.address);

    expect(afterBalance).to.be.eq(beforeBalance.add(user.amount));

    expect(tx)
      .to.emit(this.unripeClaim, "UnripeTokenClaimed")
      .withArgs(this.unripeToken1.address, user.user.address, user.amount);
  });

  it("claim unripe token only once", async function () {
    const user = data1[0];
    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [user.user.address, user.amount]
    );
    const proof = merkleTree1.getHexProof(leaf);

    await this.unripeClaim
      .connect(user.user)
      .pick(this.unripeToken1.address, user.amount, proof, EXTERNAL);

    await expect(
      this.unripeClaim
        .connect(user.user)
        .pick(this.unripeToken1.address, user.amount, proof, EXTERNAL)
    ).to.be.revertedWith("UnripeClaim: already picked");
  });

  it("claim correct unripe token", async function () {
    const user = data1[0];
    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [user.user.address, user.amount]
    );
    const proof = merkleTree1.getHexProof(leaf);

    await expect(
      this.unripeClaim
        .connect(user.user)
        .pick(this.unripeToken2.address, user.amount, proof, EXTERNAL)
    ).to.be.revertedWith("UnripeClaim: invalid proof");
  });

  it("not claim other user's unripe token", async function () {
    const user = data1[0];
    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [user.user.address, user.amount]
    );
    const proof = merkleTree1.getHexProof(leaf);

    await expect(
      this.unripeClaim
        .connect(user2)
        .pick(this.unripeToken1.address, user.amount, proof, EXTERNAL)
    ).to.be.revertedWith("UnripeClaim: invalid proof");
  });
});
