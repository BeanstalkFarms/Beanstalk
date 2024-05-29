const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { impersonateBeanstalkOwner, impersonateSigner } = require("../utils/signer.js");
const { mintEth, mintBeans } = require("../utils/mint.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const {
  BEAN,
  MAX_UINT256,
  BEAN_ETH_WELL,
  WETH,
  UNRIPE_BEAN,
  UNRIPE_LP,
  ZERO_BYTES
} = require("./utils/constants");
const { setEthUsdChainlinkPrice, setWstethUsdPrice } = require("../utils/oracle.js");
const { deployMockWellWithMockPump } = require("../utils/well.js");
const { to6, to18 } = require("./utils/helpers.js");
const {
  initalizeUsersForToken,
  endGermination,
  setRecapitalizationParams
} = require("./utils/testHelpers.js");

const { getAllBeanstalkContracts } = require("../utils/contracts");

let user, user2, owner;

describe("Invariants", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    this.diamond = contracts.beanstalkDiamond;

    bean = await ethers.getContractAt("MockToken", BEAN);

    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    owner = await impersonateBeanstalkOwner();
    await mintEth(owner.address);
    await upgradeWithNewFacets({
      diamondAddress: this.diamond.address,
      facetNames: ["MockExploitFacet"],
      bip: false,
      object: false,
      verbose: false,
      account: owner
    });

    // Set up Wells.
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await this.well.setReserves([to6("1000000"), to18("1000")]);
    // await this.well.connect(user).mint(user.address, to18('1000'))

    // Initialize users - mint bean and approve beanstalk to use all beans.
    await initalizeUsersForToken(BEAN, [user, user2, owner], to6("1000000"));
    await initalizeUsersForToken(BEAN_ETH_WELL, [user, user2, owner], to18("10000"));
    await initalizeUsersForToken(WETH, [user, user2, owner], to18("10000"));
    await initalizeUsersForToken(UNRIPE_BEAN, [user, user2, owner], to6("10000"));
    await initalizeUsersForToken(UNRIPE_LP, [user, user2, owner], to6("10000"));

    // Set up unripes.
    this.unripeBean = await ethers.getContractAt("MockToken", UNRIPE_BEAN);
    this.unripeLP = await ethers.getContractAt("MockToken", UNRIPE_LP);
    await this.unripeLP.mint(user.address, to6("10000"));
    await this.unripeLP.connect(user).approve(this.diamond.address, MAX_UINT256);
    await this.unripeBean.mint(user.address, to6("10000"));
    await this.unripeBean.connect(user).approve(this.diamond.address, MAX_UINT256);
    await mockBeanstalk.setFertilizerE(true, to6("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_BEAN, to6("10000"));
    await mockBeanstalk.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);
    await mockBeanstalk.connect(owner).addUnderlying(UNRIPE_LP, to6("10000"));
    await setRecapitalizationParams(owner);

    const whitelist = await ethers.getContractAt(
      "WhitelistFacet",
      contracts.beanstalkDiamond.address
    );

    // Set up Field.
    await mockBeanstalk.incrementTotalSoilE(to6("1000"));

    await setEthUsdChainlinkPrice("1000");
    await setWstethUsdPrice("1001");

    // Deposits tokens from 2 users.
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;
    await beanstalk.connect(user).deposit(BEAN, to6("2000"), EXTERNAL);
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;
    await beanstalk.connect(user).deposit(BEAN, to6("3000"), EXTERNAL);
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;
    await beanstalk.connect(user).deposit(UNRIPE_BEAN, to6("6000"), EXTERNAL);
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;
    await beanstalk.connect(user).deposit(UNRIPE_LP, to6("7000"), EXTERNAL);
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;

    // With the germination update, the users deposit will not be active until the remainder of the season + 1 has passed.
    await endGermination();
    expect(await mockBeanstalk.entitlementsMatchBalances()).true;
  });
  
  describe("Reverts exploits", async function () {
    it("reverts at internal accounting exploit", async function () {
      await expect(mockBeanstalk.exploitUserInternalTokenBalance()).to.be.revertedWith(
        "INV: Insufficient token balance"
      );
      await expect(mockBeanstalk.exploitUserSendTokenInternal()).to.be.revertedWith(
        "INV: Insufficient token balance"
      );
      await expect(mockBeanstalk.exploitFertilizer()).to.be.revertedWith(
        "INV: Insufficient token balance"
      );
      await expect(mockBeanstalk.exploitSop(this.well.address)).to.be.revertedWith(
        "INV: Insufficient token balance"
      );
    });

    it("reverts at token flow exploit", async function () {
      await expect(mockBeanstalk.exploitTokenBalance()).to.be.revertedWith(
        "INV: noNetFlow Token balance changed"
      );
      await expect(mockBeanstalk.exploitUserSendTokenExternal0()).to.be.revertedWith(
        "INV: noNetFlow Token balance changed"
      );
      await expect(mockBeanstalk.exploitUserSendTokenExternal1()).to.be.revertedWith(
        "INV: noOutFlow Token balance decreased"
      );
      await expect(mockBeanstalk.exploitUserDoubleSendTokenExternal()).to.be.revertedWith(
        "INV: oneOutFlow multiple token balances decreased"
      );
      await expect(mockBeanstalk.exploitBurnStalk0()).to.be.revertedWith(
        "INV: noNetFlow Stalk decreased"
      );
      await expect(mockBeanstalk.exploitBurnStalk1()).to.be.revertedWith(
        "INV: noOutFlow Stalk decreased"
      );
    });

    it("reverts at supply exploit", async function () {
      await expect(mockBeanstalk.exploitBurnBeans()).to.be.revertedWith("INV: Supply changed");
      await expect(mockBeanstalk.exploitMintBeans0()).to.be.revertedWith("INV: Supply changed");
      await expect(mockBeanstalk.exploitMintBeans1()).to.be.revertedWith("INV: Supply changed");
      await expect(mockBeanstalk.exploitMintBeans2()).to.be.revertedWith("INV: Supply increased");
      await expect(mockBeanstalk.exploitMintBeans3()).to.be.revertedWith("INV: Supply increased");
    });

    // if("tracks SOP token", async function () {})
  });
});
