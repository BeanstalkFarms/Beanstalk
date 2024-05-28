const { expect } = require("chai");
const { defaultAbiCoder } = require("ethers/lib/utils.js");
const { deploy } = require("../scripts/deploy.js");
const { getBeanstalk, getBean, getUsdc } = require("../utils/contracts.js");
const { toBN, encodeAdvancedData } = require("../utils/index.js");
const { impersonateSigner } = require("../utils/signer.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const {
  STABLE_FACTORY,
  WETH,
  BEAN,
  PIPELINE
} = require("./utils/constants.js");
const { to6, to18 } = require("./utils/helpers.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;

describe("Depot Facet", function () {
  before(async function () {
    [owner, user, user2, user3] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    this.diamond = contracts.beanstalkDiamond.address;
    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await getBean();
    this.usdc = await getUsdc();
    this.weth = await ethers.getContractAt("MockWETH", WETH);

    pipeline = await ethers.getContractAt("Pipeline", PIPELINE);

    this.mockContract = await (await ethers.getContractFactory("MockContract", owner)).deploy();
    await this.mockContract.deployed();
    await this.mockContract.setAccount(user2.address);

    await bean.mint(user.address, to6("1000"));
    await this.usdc.mint(user.address, to6("1000"));

    await bean.connect(user).approve(beanstalk.address, to18("1"));
    await this.usdc.connect(user).approve(beanstalk.address, to18("1"));

    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.mint(user.address, to6("10000"));
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Normal Pipe", async function () {
    describe("1 Pipe", async function () {
      beforeEach(async function () {
        expect(await bean.balanceOf(user3.address)).to.be.equal(to6("0"));

        await bean.mint(pipeline.address, to6("100"));
        const transferBeans = bean.interface.encodeFunctionData("transfer", [
          user3.address,
          to6("100")
        ]);
        await beanstalk.connect(user).pipe([bean.address, transferBeans]);
      });

      it("erc20 transfer beans", async function () {
        expect(await bean.balanceOf(user3.address)).to.be.equal(to6("100"));
      });
    });

    describe("Multi Pipe", async function () {
      beforeEach(async function () {
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(
          to6("0")
        );

        await bean.mint(pipeline.address, to6("100"));
        const approve = await bean.interface.encodeFunctionData("approve", [
          beanstalk.address,
          to6("100")
        ]);
        const tokenTransfer = beanstalk.interface.encodeFunctionData("transferToken", [
          bean.address,
          user.address,
          to6("100"),
          0,
          1
        ]);
        await beanstalk.connect(user).multiPipe([
          [bean.address, approve],
          [beanstalk.address, tokenTransfer]
        ]);
      });

      it("approves and transfers beans via beanstalk", async function () {
        expect(await beanstalk.getInternalBalance(user.address, bean.address)).to.be.equal(
          to6("100")
        );
      });
    });
  });

  describe("Ether Pipe", async function () {
    beforeEach(async function () {
      selector = this.weth.interface.encodeFunctionData("deposit", []);
      await beanstalk.connect(user).etherPipe([WETH, selector], to18("1"), { value: to18("1") });
    });

    it("wraps Eth", async function () {
      expect(await this.weth.balanceOf(pipeline.address)).to.be.equal(to18("1"));
      expect(await ethers.provider.getBalance(WETH)).to.be.equal(to18("1"));
    });
  });

  describe("Advanced Pipe", async function () {
    it("reverts if non-existent type", async function () {
      selector = this.weth.interface.encodeFunctionData("deposit", []);
      data = encodeAdvancedData(9);
      await expect(
        beanstalk.connect(user).advancedPipe([[WETH, selector, data]], to18("0"))
      ).to.be.revertedWith("Clipboard: Type not supported");
    });

    describe("Ether Pipe to Internal", async function () {
      beforeEach(async function () {
        selector = this.weth.interface.encodeFunctionData("deposit", []);
        selector2 = await this.weth.interface.encodeFunctionData("approve", [
          beanstalk.address,
          to18("1")
        ]);
        selector3 = beanstalk.interface.encodeFunctionData("transferToken", [
          WETH,
          user.address,
          to18("1"),
          0,
          1
        ]);
        data = encodeAdvancedData(0, to18("1"));
        data23 = encodeAdvancedData(0);
        await beanstalk.connect(user).advancedPipe(
          [
            [WETH, selector, data],
            [WETH, selector2, data23],
            [beanstalk.address, selector3, data23]
          ],
          to18("1"),
          { value: to18("1") }
        );
      });

      it("wraps Eth and transfers to user internal", async function () {
        expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal(to18("1"));
        expect(await beanstalk.getInternalBalance(user.address, this.weth.address)).to.be.equal(
          to18("1")
        );
        expect(await ethers.provider.getBalance(WETH)).to.be.equal(to18("1"));
      });
    });

    describe("Return data", async function () {
      beforeEach(async function () {
        await bean.connect(user).transfer(pipeline.address, to6("1"));
        selector = bean.interface.encodeFunctionData("balanceOf", [pipeline.address]);
        data = encodeAdvancedData(0);
        selector2 = bean.interface.encodeFunctionData("transfer", [user2.address, "0"]);
        data2 = encodeAdvancedData(1, (value = to6("0")), (copyData = [0, 32, 68]));
        await beanstalk.connect(user).advancedPipe(
          [
            [bean.address, selector, data],
            [bean.address, selector2, data2]
          ],
          to18("0")
        );
      });

      it("wraps Eth and transfers to user internal", async function () {
        expect(await bean.balanceOf(pipeline.address)).to.be.equal(toBN("0"));
        expect(await bean.balanceOf(user2.address)).to.be.equal(to6("1"));
      });
    });

    describe("Multiple return data", async function () {
      beforeEach(async function () {
        await bean.connect(user).transfer(pipeline.address, to6("1"));
        selector = bean.interface.encodeFunctionData("balanceOf", [pipeline.address]);
        selector2 = this.mockContract.interface.encodeFunctionData("getAccount", []);
        data12 = encodeAdvancedData(0);
        selector3 = bean.interface.encodeFunctionData("transfer", [user.address, to6("1")]);
        data3 = encodeAdvancedData(
          2,
          (value = to6("0")),
          (copyData = [
            [0, 32, 68],
            [1, 32, 36]
          ])
        );
        await beanstalk.connect(user).advancedPipe(
          [
            [bean.address, selector, data12],
            [this.mockContract.address, selector2, data12],
            [bean.address, selector3, data3]
          ],
          to18("0")
        );
      });

      it("wraps Eth and transfers to user internal", async function () {
        expect(await bean.balanceOf(pipeline.address)).to.be.equal(toBN("0"));
        expect(await bean.balanceOf(user2.address)).to.be.equal(to6("1"));
      });
    });
  });

  describe("Read Pipe", async function () {
    it("returns a value", async function () {
      selector = bean.interface.encodeFunctionData("balanceOf", [user.address]);
      const pipeResult = await beanstalk.readPipe([BEAN, selector]);
      expect(defaultAbiCoder.decode(["uint256"], pipeResult)[0]).to.be.equal(to6("11000"));
    });
  });
});
