const {
  EXTERNAL,
} = require("./utils/balances.js");
const { WETH } = require("./utils/constants");
const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { ethers } = require("hardhat");
const { to18 } = require("./utils/helpers.js");

let user, user2, owner;
let userAddress, ownerAddress, user2Address, fundraiserAddress;

describe("UnwrapAndSendETH", function () {
  if (!!process.env.FORKING_RPC) {
    before(async function () {
      [owner, user, user2] = await ethers.getSigners();
      userAddress = user.address;
      user2Address = user2.address;
      try {
        await network.provider.request({
          method: "hardhat_reset",
          params: [
            {
              forking: {
                jsonRpcUrl: process.env.FORKING_RPC,
                blockNumber: 16074698,
              },
            },
          ],
        });
      } catch {
        return;
      }
      const contracts = await deploy("Test", false, true, false);
      ownerAddress = contracts.account;
      this.diamond = contracts.beanstalkDiamond;
      this.farm = await ethers.getContractAt("FarmFacet", this.diamond.address);
      this.tokenFacet = await ethers.getContractAt(
        "TokenFacet",
        this.diamond.address
      );

      this.weth = await ethers.getContractAt("IERC20", WETH);

      wrapEth = await this.tokenFacet.interface.encodeFunctionData("wrapEth", [
        to18("1"),
        EXTERNAL,
      ]);

      const unwrapAndSendETH = await ethers.getContractFactory(
        "UnwrapAndSendETH",
        {
          signer: owner,
        }
      );
      this.unwrapAndSendETH = await unwrapAndSendETH.deploy();
      await this.unwrapAndSendETH.deployed();
    });

    beforeEach(async function () {
      snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
      await revertToSnapshot(snapshotId);
    });

    describe("unwrap weth and send eth", function () {
      this.beforeEach(async function () {
        await this.farm.connect(user).farm([wrapEth], { value: to18("1") });
      });
      describe("reverts", async function () {
        it("reverts if zero WETH in contract ", async function () {
          await expect(
            this.unwrapAndSendETH.connect(user).unwrapAndSendETH(user2Address)
          ).to.be.revertedWith("Insufficient WETH");
        });
        it("reverts if to address doesn't accept eth", async function () {
          await this.weth.connect(user).transfer(
            this.unwrapAndSendETH.address,
            to18("1")
          );
          await expect(
            this.unwrapAndSendETH.connect(user).unwrapAndSendETH('0x77700005BEA4DE0A78b956517f099260C2CA9a26')
          ).to.be.revertedWith("Eth transfer Failed.");
        });
      });

      describe("load, unwrap and send", async function () {
        beforeEach(async function () {
          // Load WETH into helper contract
          await this.weth
            .connect(user)
            .transfer(this.unwrapAndSendETH.address, to18("1"));
          await this.unwrapAndSendETH.unwrapAndSendETH(user2Address);
        });

        it("correctly unload weth/eth", async function () {
          expect(
            await this.weth.balanceOf(this.unwrapAndSendETH.address)
          ).to.be.equal("0");
          expect(
            await ethers.provider.getBalance(this.unwrapAndSendETH.address)
          ).to.be.equal("0");
        });

        it("correctly update user balance", async function () {
          expect(await this.weth.balanceOf(userAddress)).to.be.equal("0");
          expect(await ethers.provider.getBalance(user2Address)).to.be.equal(to18("10001"));
        });
      });
    });
  } else {
    it("skip", async function () {
      console.log("Set FORKING_RPC in .env file to run tests");
    });
  }
});
