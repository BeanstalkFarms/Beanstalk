const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { getAllBeanstalkContracts } = require("../utils/contracts");
const { EXTERNAL } = require("./utils/balances.js");
const { to18, to6, toStalk, toBN } = require("./utils/helpers.js");
const { BEAN, ZERO_ADDRESS } = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { initalizeUsersForToken, endGermination } = require("./utils/testHelpers.js");
const axios = require("axios");
const fs = require("fs");
const { impersonateBeanWstethWell } = require("../utils/well.js");

let user, user2, owner;

describe("newSilo", function () {
  before(async function () {
    [owner, user, user2, user3, user4] = await ethers.getSigners();
    const contracts = await deploy((verbose = false), (mock = true), (reset = true));

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(contracts.beanstalkDiamond.address);

    // initalize users - mint bean and approve beanstalk to use all beans.
    await initalizeUsersForToken(BEAN, [user, user2, user3, user4], to6("10000"));

    // deposit 1000 beans from 2 users.
    await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);
    await beanstalk.connect(user2).deposit(BEAN, to6("1000"), EXTERNAL);

    // with the germination update, the users deposit will not be active until the remainder of the season + 1 has passed.
    await endGermination();

    // impersonate bean-wsteth well. Needed as the well needs to be called as an ERC20.
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Silo Balances After Deposits", function () {
    it("properly updates the user balances", async function () {
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000"));
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000000000000000"));
      await beanstalk.mow(user.address, BEAN);
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.4"));
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000400000000000"));
    });

    it("properly updates the total balances", async function () {
      expect(await beanstalk.totalStalk()).to.eq(toStalk("2000"));
      expect(await beanstalk.totalRoots()).to.eq(toStalk("2000000000000000"));
      await beanstalk.mow(user.address, BEAN);
      expect(await beanstalk.totalStalk()).to.eq(toStalk("2000.4"));
      expect(await beanstalk.totalRoots()).to.eq(toStalk("2000400000000000"));
    });
  });

  describe("Silo Balances After Withdrawal", function () {
    beforeEach(async function () {
      await beanstalk.connect(user).withdrawDeposit(BEAN, to6("0"), to6("500"), EXTERNAL);
    });

    it("properly updates the total balances", async function () {
      // 2 seasons has passed, so we expect 0.4 stalk to be grown (1000.4 stalk total)
      // Since the user withdrawn half of their deposit,
      // we expect an additional 0.2 stalk to be withdrawn.
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("500.2"));
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("500200000000000"));
    });

    it("properly updates the total balances", async function () {
      expect(await beanstalk.totalStalk()).to.eq(toStalk("1500.2"));
      expect(await beanstalk.totalRoots()).to.eq(toStalk("1500200000000000"));
    });
  });

  describe("Silo Sunrise", async function () {
    describe("Single", async function () {
      beforeEach(async function () {
        await mockBeanstalk.siloSunrise(to6("100"));
      });

      it("properly updates the earned balances", async function () {
        expect(await beanstalk.balanceOfGrownStalk(user.address, BEAN)).to.eq(toStalk("0.6"));
        expect(await beanstalk.balanceOfEarnedBeans(user.address)).to.eq(to6("50"));
        expect(await beanstalk.balanceOfEarnedStalk(user.address)).to.eq(toStalk("50"));
        expect(await beanstalk.totalEarnedBeans()).to.eq(to6("100"));
      });

      it("properly updates the users balances", async function () {
        expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1050"));
        expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000000000000000"));
      });

      it("properly updates the total balances", async function () {
        expect(await beanstalk.totalStalk()).to.eq(toStalk("2100"));
        expect(await beanstalk.totalRoots()).to.eq(toStalk("2000000000000000"));
      });
    });
  });

  describe("Single Earn", async function () {
    beforeEach(async function () {
      await mockBeanstalk.siloSunrise(to6("100"));
      await beanstalk.mow(user2.address, BEAN);
      this.result = await beanstalk.connect(user).plant();
    });

    it("properly updates the earned balances", async function () {
      expect(await beanstalk.balanceOfGrownStalk(user.address, BEAN)).to.eq("0");
      expect(await beanstalk.balanceOfEarnedBeans(user.address)).to.eq("0");
      expect(await beanstalk.balanceOfEarnedStalk(user.address)).to.eq("0");
      expect(await beanstalk.totalEarnedBeans()).to.eq(to6("50"));
    });

    it("properly updates the total balances", async function () {
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1050.6"));
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq("10005714285714285714285714");
    });

    it("properly updates the total balances", async function () {
      expect(await beanstalk.totalStalk()).to.eq(to6("21012000"));
      expect(await beanstalk.totalRoots()).to.eq("20011428571428571428571428");
    });

    it("properly emits events", async function () {
      expect(this.result).to.emit(beanstalk, "Earn");
    });

    it("user2 earns rest", async function () {
      await beanstalk.connect(user2).plant();
      expect(await beanstalk.totalEarnedBeans()).to.eq("0");
      expect(await beanstalk.balanceOfStalk(user2.address)).to.eq(toStalk("1050.6"));
      expect(await beanstalk.balanceOfRoots(user2.address)).to.eq("10005714285714285714285714");
    });

    it("user can withdraw earned beans", async function () {
      stemTip = await beanstalk.stemTipForToken(BEAN);
      await beanstalk.connect(user).withdrawDeposit(BEAN, stemTip, to6("25"), EXTERNAL);

      // add Bean deposit, such that the stem tip matches with the earned beans, and verify withdraw.
      await beanstalk.connect(user).deposit(BEAN, to6("25"), EXTERNAL);
      await beanstalk.connect(user).withdrawDeposit(BEAN, stemTip, to6("50"), EXTERNAL);
    });

    it("user can withdraws earned beans", async function () {
      stemTip = await beanstalk.stemTipForToken(BEAN);
      await beanstalk.connect(user).withdrawDeposits(BEAN, [stemTip], [to6("25")], EXTERNAL);

      // add Bean deposit, such that the stem tip matches with the earned beans, and verify withdraw.
      await beanstalk.connect(user).deposit(BEAN, to6("25"), EXTERNAL);
      await beanstalk.connect(user).withdrawDeposits(BEAN, [stemTip], [to6("50")], EXTERNAL);
    });

    it("user can withdraws multiple earned beans", async function () {
      stemTip = await beanstalk.stemTipForToken(BEAN);
      await beanstalk.connect(user).withdrawDeposits(BEAN, [stemTip], [to6("25")], EXTERNAL);

      // add Bean deposit, such that the stem tip matches with the earned beans, and verify withdraw.
      await beanstalk.connect(user).deposit(BEAN, to6("25"), EXTERNAL);
      await mockBeanstalk.siloSunrise("0");
      stemTip1 = await beanstalk.stemTipForToken(BEAN);
      await beanstalk.connect(user).deposit(BEAN, to6("50"), EXTERNAL);
      await beanstalk
        .connect(user)
        .withdrawDeposits(BEAN, [stemTip, stemTip1], [to6("50"), to6("50")], EXTERNAL);
    });

    it("user can transfer earned beans", async function () {
      stemTip = await beanstalk.stemTipForToken(BEAN);
      await beanstalk
        .connect(user)
        .transferDeposit(user.address, user2.address, BEAN, stemTip, to6("25"));
      // add Bean deposit, such that the stem tip matches with the earned beans, and verify withdraw.
      await beanstalk.connect(user).deposit(BEAN, to6("25"), EXTERNAL);
      await beanstalk
        .connect(user)
        .transferDeposit(user.address, user2.address, BEAN, stemTip, to6("50"));
    });

    it("user can transferDeposits earned beans", async function () {
      stemTip = await beanstalk.stemTipForToken(BEAN);
      await beanstalk
        .connect(user)
        .transferDeposits(user.address, user2.address, BEAN, [stemTip], [to6("50")]);
    });

    it("user can transferDeposits earned beans", async function () {
      stemTip0 = await beanstalk.stemTipForToken(BEAN);
      await beanstalk
        .connect(user)
        .transferDeposits(user.address, user2.address, BEAN, [stemTip], [to6("25")]);
      // pass 1 season, deposit, and verify user can transfer.
      await mockBeanstalk.siloSunrise("0");
      stemTip1 = await beanstalk.stemTipForToken(BEAN);
      await beanstalk.connect(user).deposit(BEAN, to6("25"), EXTERNAL);
      await beanstalk
        .connect(user)
        .transferDeposits(
          user.address,
          user2.address,
          BEAN,
          [stemTip0, stemTip1],
          [to6("25"), to6("25")]
        );
    });
  });

  describe("ERC1155 Deposits", async function () {
    beforeEach(async function () {
      // deposit 1000 beans at season 2.
      await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);
    });

    it("mints an ERC1155 when depositing an whitelisted asset", async function () {
      // we use user 3 as user 1 + user 2 has already deposited - this makes it more clear
      this.result = await beanstalk.connect(user3).deposit(BEAN, to6("1000"), EXTERNAL);
      stem = await beanstalk.stemTipForToken(BEAN);
      depositID = await beanstalk.getDepositId(BEAN, stem);

      expect(await beanstalk.balanceOf(user3.address, depositID)).to.eq(to6("1000"));
      await expect(this.result)
        .to.emit(beanstalk, "TransferSingle")
        .withArgs(user3.address, ZERO_ADDRESS, user3.address, depositID, to6("1000"));
    });

    it("adds to the ERC1155 balance when depositing an whitelisted asset", async function () {
      this.result = await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);
      season = beanstalk.season();
      stem = beanstalk.stemTipForToken(BEAN);
      depositID = await beanstalk.getDepositId(BEAN, stem);
      expect(await beanstalk.balanceOf(user.address, depositID)).to.eq(to6("2000"));

      await expect(this.result).to.emit(beanstalk, "TransferSingle").withArgs(
        user.address, // operator
        ZERO_ADDRESS, // from
        user.address, // to
        depositID, // depositID
        to6("1000") // amt
      );
    });

    it("removes ERC1155 balance when withdrawing an whitelisted asset", async function () {
      // user 1 already deposited 1000, so we expect the balanceOf to be 500e6 here.
      season = beanstalk.season();
      stem = beanstalk.stemTipForToken(BEAN);
      depositID = await beanstalk.getDepositId(BEAN, stem);
      expect(await beanstalk.balanceOf(user.address, depositID)).to.eq(to6("1000"));
      this.result = await beanstalk.connect(user).withdrawDeposit(BEAN, stem, to6("500"), EXTERNAL);
      await expect(this.result).to.emit(beanstalk, "TransferSingle").withArgs(
        user.address, // operator
        user.address, // from
        ZERO_ADDRESS, // to
        depositID, // depositID
        to6("500") // amt
      );
      expect(await beanstalk.balanceOf(user.address, depositID)).to.eq(to6("500"));
    });

    it("transfers an ERC1155 deposit", async function () {
      // transferring the most recent deposit from user 1, to user 3
      // user 1 currently has 2000.4 stalk (1000 stalk, 1000 germinating stalk, and 0.4 grown stalk),
      season = beanstalk.season();
      stem = beanstalk.stemTipForToken(BEAN);
      depositID = await beanstalk.getDepositId(BEAN, stem);

      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.4"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("1000"));
      expect(await beanstalk.balanceOfStalk(user3.address)).to.eq(to6("0"));
      expect(await beanstalk.balanceOfGerminatingStalk(user3.address)).to.eq(toStalk("0"));

      // get roots (note that germinating roots cannot be calculated until 2 gms have passed, and thus do
      // not exist/have a view function).
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000400000000000"));
      expect(await beanstalk.balanceOfRoots(user3.address)).to.eq("0");

      this.result = await beanstalk
        .connect(user)
        .safeTransferFrom(user.address, user3.address, depositID, to6("1000"), 0x00);

      // user 1 should have 1000.4 stalk and 0 germinating stalk.
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.4"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("0"));
      // user 3 should have 0 stalk and 1000 germinating stalk.
      expect(await beanstalk.balanceOfStalk(user3.address)).to.eq(toStalk("0"));
      expect(await beanstalk.balanceOfGerminatingStalk(user3.address)).to.eq(toStalk("1000"));

      // user 1 should still have 1000.4 roots.
      // user 3 should not have any roots, as the deposit has not been in the silo for 2 seasons.
      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000400000000000"));
      expect(await beanstalk.balanceOfRoots(user3.address)).to.eq(toStalk("0"));

      expect(await beanstalk.balanceOf(user.address, depositID)).to.eq(to6("0"));
      expect(await beanstalk.balanceOf(user3.address, depositID)).to.eq(to6("1000"));

      // transfer deposit has two events, one burns and one mints
      await expect(this.result).to.emit(beanstalk, "TransferSingle").withArgs(
        user.address, // operator
        user.address, // from
        user3.address, // to
        depositID, // depositID
        to6("1000") // amt
      );
    });

    it("batch transfers an ERC1155 deposit", async function () {
      // skip to next season, user 1 deposits again, and batch transfers the ERC1155 to user 3
      season = beanstalk.season();
      stem0 = beanstalk.stemTipForToken(BEAN);
      depositID0 = await beanstalk.getDepositId(BEAN, stem0);
      // user has 1000.4 grown stalk + 1000 germinating stalk.
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.4"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("1000"));

      await mockBeanstalk.farmSunrise();

      season = beanstalk.season();
      stem1 = beanstalk.stemTipForToken(BEAN);
      depositID1 = await beanstalk.getDepositId(BEAN, stem1);

      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.4"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("1000"));

      this.result = await beanstalk.connect(user).deposit(BEAN, to6("1000"), EXTERNAL);

      // users stalk increased by 0.4 as they mowed from the deposit, and
      // had 2000 stalk at the time of mowing (1000 of which is germinating).
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.8"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("2000"));
      expect(await beanstalk.balanceOfStalk(user3.address)).to.eq(toStalk("0"));

      // depositID0 has been in the silo for 1 season, and thus should have .2 additional stalk.
      // depositID1 has been in the silo for 0 seasons, and should not have any grown stalk.
      this.result = await beanstalk
        .connect(user)
        .safeBatchTransferFrom(
          user.address,
          user3.address,
          [depositID0, depositID1],
          [to6("1000"), to6("1000")],
          0x00
        );

      // after the transfer, user 1 should have 1000.6 stalk and no germinating stalk.
      // user 3 should have 0.2 stalk and 2000 germinating stalk.
      expect(await beanstalk.balanceOfStalk(user.address)).to.eq(toStalk("1000.6"));
      expect(await beanstalk.balanceOfGerminatingStalk(user.address)).to.eq(toStalk("0"));
      expect(await beanstalk.balanceOfStalk(user3.address)).to.eq(toStalk(".2"));
      expect(await beanstalk.balanceOfGerminatingStalk(user3.address)).to.eq(toStalk("2000"));

      expect(await beanstalk.balanceOfRoots(user.address)).to.eq(toStalk("1000600000000000"));
      expect(await beanstalk.balanceOfRoots(user3.address)).to.eq(toStalk("200000000000"));

      expect(await beanstalk.balanceOf(user.address, depositID0)).to.eq(to6("0"));
      expect(await beanstalk.balanceOf(user.address, depositID1)).to.eq(to6("0"));
      expect(await beanstalk.balanceOf(user3.address, depositID0)).to.eq(to6("1000"));
      expect(await beanstalk.balanceOf(user3.address, depositID1)).to.eq(to6("1000"));

      // transfer deposit emits
      await expect(this.result).to.emit(beanstalk, "TransferSingle").withArgs(
        user.address, // operator
        user.address, // from
        user3.address, // to
        depositID0, // depositID
        to6("1000") // amt
      );

      await expect(this.result).to.emit(beanstalk, "TransferSingle").withArgs(
        user.address, // operator
        user.address, // from
        user3.address, // to
        depositID1, // depositID
        to6("1000") // amt
      );
    });

    it("properly gives the correct batch balances", async function () {
      await beanstalk.connect(user2).deposit(BEAN, to6("1000"), EXTERNAL);
      let depositID = await beanstalk.getDepositId(BEAN, await beanstalk.stemTipForToken(BEAN));
      let b = await beanstalk.balanceOfBatch([user.address, user2.address], [depositID, depositID]);
      expect(b[0]).to.eq(to6("1000"));
      expect(b[1]).to.eq(to6("1000"));
    });

    it("properly gives the correct depositID", async function () {
      stem = beanstalk.stemTipForToken(BEAN);
      depositID = await beanstalk.getDepositId(BEAN, stem);
      // first 20 bytes is the address,
      // next 12 bytes is the stem
      // since this deposit was created 1 season after the asset was whitelisted, the amt is 4
      expect(depositID).to.eq("0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab0000000000000000003D0900");
    });

    it("properly emits an event when a user approves for all", async function () {
      await expect(beanstalk.connect(user).setApprovalForAll(user2.address, true))
        .to.emit(beanstalk, "ApprovalForAll")
        .withArgs(user.address, user2.address, true);
      expect(await beanstalk.isApprovedForAll(user.address, user2.address)).to.eq(true);
    });

    it("properly gives the correct ERC-165 identifier", async function () {
      expect(await beanstalk.supportsInterface("0xd9b67a26")).to.eq(true);
      expect(await beanstalk.supportsInterface("0x0e89341c")).to.eq(true);
    });
  });

  describe("ERC1155 Metadata", async function () {
    beforeEach(async function () {
      // 2 seasons were added in before. (998 + 2 = 1000)
      await mockBeanstalk.farmSunrises(998);
    });

    it("is a valid json", async function () {
      depositID1 = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab0000000000000000001E8480";
      const depositmetadata = await beanstalk.uri(depositID1);
      depositMetadataString = atob(depositmetadata.substring(29));
      // verify that depositMetadataString is a json:
      expect((await tryParseJSONObject(depositMetadataString)) == true);
    });

    it.skip("returns correct json values", async function () {
      SiloTokens = await beanstalk.getSiloTokens();
      // iterate through silo tokens:
      stem = "000000000000000000000000";
      for (let i = 0; i < SiloTokens.length; i++) {
        depositID = SiloTokens[i] + stem;
        uri = await beanstalk.uri(depositID);
        metadataToken = await ethers.getContractAt("MockToken", SiloTokens[i]);
        tokenSettings = await beanstalk.tokenSettings(metadataToken.address);
        const response = await axios.get(uri);
        const symbol = (await metadataToken.symbol()).includes("urBEAN3CRV")
          ? "urBEANLP"
          : await metadataToken.symbol();
        jsonResponse = JSON.parse(response.data.toString());
        expect(jsonResponse.name).to.be.equal(`Beanstalk Silo Deposits`);
        expect(jsonResponse.attributes[0].value).to.be.equal(symbol);
        expect(jsonResponse.attributes[1].value).to.be.equal(metadataToken.address.toLowerCase());
        expect(jsonResponse.attributes[2].value).to.be.equal(depositID.toLowerCase());
        expect(jsonResponse.attributes[3].value).to.be.equal(parseInt(stem, 16));
        expect(jsonResponse.attributes[4].value).to.be.equal(tokenSettings[2]);
        expect(jsonResponse.attributes[6].value).to.be.equal(tokenSettings[1]);
      }
    });

    // previous tests - kept for reference
    // bean token
    it.skip("returns correct URI for bean", async function () {
      depositID1 = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab0000000000000000001E8480";
      uri = await beanstalk.uri(depositID1);
      const response = await axios.get(uri);
      jsonResponse = JSON.parse(response.data.toString());
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageBean.txt",
        "utf-8"
      );
      expect(await beanstalk.uri(depositID1)).to.eq(depositmetadata);
    });

    // bean3crv token
    it.skip("returns correct URI for bean3crv", async function () {
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageBean3Crv.txt",
        "utf-8"
      );
      depositID2 = "0xC9C32CD16BF7EFB85FF14E0C8603CC90F6F2EE4900000000000000001E848000";
      expect(await beanstalk.uri(depositID2)).to.eq(depositmetadata);
    });

    // beanEthToken
    it.skip("returns correct URI for beanEth", async function () {
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageBeanEth.txt",
        "utf-8"
      );
      depositID3 = "0xBEA0e11282e2bB5893bEcE110cF199501e872bAdFFFFFFFFFFFFF000001E8480";
      expect(await beanstalk.uri(depositID3)).to.eq(depositmetadata);
    });

    // urBean token
    it.skip("returns correct URI for urBean", async function () {
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageUrBean.txt",
        "utf-8"
      );
      depositID4 = "0x1BEA0050E63e05FBb5D8BA2f10cf5800B62244490000000000000000003D0900";
      expect(await beanstalk.uri(depositID4)).to.eq(depositmetadata);
    });

    // urBeanEth token
    it.skip("returns correct URI for urBeanEth", async function () {
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageUrBeanEth.txt",
        "utf-8"
      );
      depositID5 = "0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716DFFFFFFFFFFFFFFFFFFFFF97C";
      expect(await beanstalk.uri(depositID5)).to.eq(depositmetadata);
    });

    it.skip("returns correct URI dewhitelisted assets", async function () {
      await beanstalk.connect(owner).dewhitelistToken(this.beanMetapool.address);
      depositmetadata = await fs.readFileSync(
        __dirname + "/data/base64EncodedImageBean3CrvDewhitelisted.txt",
        "utf-8"
      );
      depositID2 = "0xC9C32CD16BF7EFB85FF14E0C8603CC90F6F2EE4900000000000000001E848000";
      expect(await beanstalk.uri(depositID2)).to.eq(depositmetadata);
    });

    it("reverts if the depositID is invalid", async function () {
      // invalid due to token
      invalidID0 = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efac000000000000000000000002";
      // invalid due to high stem value.
      invalidID1 = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab100000000000000000000002";

      await expect(beanstalk.uri(invalidID0)).to.be.revertedWith("Silo: metadata does not exist");
      await expect(beanstalk.uri(invalidID1)).to.be.revertedWith("Silo: metadata does not exist");
    });
  });

  /**
   * These sets of tests handle the germination process and the planting of beans.
   */
  describe("germination", async function () {
    before(async function () {
      await beanstalk.connect(user3).deposit(BEAN, to6("1000"), EXTERNAL);
      this.result = await beanstalk.connect(user4).deposit(BEAN, to6("1000"), EXTERNAL);

      // after these deposits, the state is currently:
      // user 1: 1000 stalk, 0 germinating stalk (0.4 pending grown stalk).
      // user 2: 1000 stalk, 0 germinating stalk (0.4 pending grown stalk).
      // user 3: 0 stalk, 1000 germinating stalk.
      // user 4: 0 stalk, 1000 germinating stalk.
    });

    describe("deposits", async function () {
      it("properly updates the user balances", async function () {
        expect(await beanstalk.balanceOfGerminatingStalk(user3.address)).to.eq(toStalk("1000"));
        expect(await beanstalk.balanceOfGerminatingStalk(user4.address)).to.eq(toStalk("1000"));
      });

      it("emit events", async function () {
        season = await beanstalk.season();
        expect(this.result)
          .to.emit(beanstalk, "FarmerGerminatingStalkBalanceChanged")
          .withArgs(user4.address, toStalk("1000"));
        expect(this.result)
          .to.emit(beanstalk, "TotalGerminatingBalanceChanged")
          .withArgs("3", BEAN, to6("1000"), to6("1000"));
        expect(this.result)
          .to.emit(beanstalk, "TotalGerminatingStalkChanged")
          .withArgs(season, toStalk("1000"));
      });
    });

    describe("withdraw", async function () {
      beforeEach(async function () {
        this.result = await beanstalk
          .connect(user4)
          .withdrawDeposit(BEAN, to6("4"), to6("1000"), EXTERNAL);
      });
      it("properly updates the user balances", async function () {
        expect(await beanstalk.balanceOfGerminatingStalk(user4.address)).to.eq(0);
      });

      it("emit events", async function () {
        season = await beanstalk.season();
        expect(this.result)
          .to.emit(beanstalk, "FarmerGerminatingStalkBalanceChanged")
          .withArgs(user4.address, toStalk("-1000"));
        expect(this.result)
          .to.emit(beanstalk, "TotalGerminatingBalanceChanged")
          .withArgs("3", BEAN, to6("-1000"), to6("-1000"));
        expect(this.result)
          .to.emit(beanstalk, "TotalGerminatingStalkChanged")
          .withArgs(season, toStalk("-1000"));
      });
    });

    // tests a farmers deposit that has no earned bean prior
    describe("Earned beans Germination", async function () {
      beforeEach(async function () {
        await mockBeanstalk.siloSunrise(to6("100"));
        // after this sunrise, user 3 and 4 have currently halfway done with
        // the germination process.
        // user 1 and 2 should have 50 earned beans.
        season = await beanstalk.season();
      });

      it("a single farmer germination", async function () {
        // user 1 and 2 should have 50% of the earned beans.
        checkMultipleEarnedBeans([
          [user, to6("50")],
          [user2, to6("50")]
        ]);

        // user 1 plants, and should have 50 beans deposited this season.
        await beanstalk.connect(user).plant();
        expect(
          (await beanstalk.getDeposit(user.address, BEAN, await beanstalk.stemTipForToken(BEAN)))[0]
        ).to.eq(49999999);

        // user 1 should now have 0 earned beans.
        checkMultipleEarnedBeans([
          [user, 0],
          [user2, to6("50")]
        ]);

        // advance to the next season.
        await mockBeanstalk.farmSunrise();

        // verify balances.
        checkMultipleEarnedBeans([
          [user, 1],
          [user2, to6("50")]
        ]);

        // verify other users plant.
        await multiPlant([user2, user3, user4, user]);

        stem = await beanstalk.stemTipForToken(BEAN);
        checkMultipleEarnedBeans([
          [user, 1],
          [user2, to6("50")],
          [user3, 0],
          [user4, 0]
        ]);

        // verify balances.
        checkMultipleEarnedBeans([
          [user, 0],
          [user2, 0],
          [user3, 0],
          [user4, 0]
        ]);
      });

      it("multiple farmers germination", async function () {
        await multiPlant([user, user2, user3, user4]);

        checkMultipleNewPlants([
          [user, 49999999],
          [user2, to6("50")],
          [user3, 0],
          [user4, 0]
        ]);

        // advance to the next season.
        // user 3 and 4 should not have any earned beans,
        // as the germination period has just ended.
        await mockBeanstalk.siloSunrise(0);
        stem = await beanstalk.stemTipForToken(BEAN);

        await multiPlant([user3, user4]);

        checkMultipleEarnedBeans([
          [user, 0],
          [user2, 0],
          [user3, 0],
          [user4, 0]
        ]);

        // verify all users have no earned beans.
        checkMultipleNewPlants([
          [user, 0],
          [user2, 0],
          [user3, 0],
          [user4, 0]
        ]);
      });

      it("beans are minted midway and post germination", async function () {
        // call a sunrise with 100 beans.
        await mockBeanstalk.siloSunrise(to6("100"));
        // after this sunrise, user 3 and 4 have finished the germination process.
        // they should not have any earned beans at this moment.
        checkMultipleEarnedBeans([
          [user, to6("100")],
          [user2, to6("100")],
          [user3, 0],
          [user4, 0]
        ]);

        // call a sunrise with 100 beans.
        await mockBeanstalk.siloSunrise(to6("100"));

        // user 1 and 2 should have slightly higher earned beans due to previous earned beans.
        checkMultipleEarnedBeans([
          [user, 126190476],
          [user2, 126190476],
          [user3, 23809523],
          [user4, 23809523]
        ]);

        await multiPlant([user, user2, user3, user4]);

        // verify new plants.
        checkMultipleNewPlants([
          [user, 126190476],
          [user2, 126190476],
          [user3, 23809523],
          [user4, 23809523]
        ]);
      });

      it("beans are issued with grown stalk from germinating assets", async function () {
        // user 3 and 4 mows their grown stalk.
        await beanstalk.mow(user3.address, BEAN);
        await beanstalk.mow(user4.address, BEAN);
        // user 3 and 4 should have 0 stalk and 0 germinating stalk.

        expect(await beanstalk.balanceOfStalk(user3.address)).to.eq(toStalk("0.2"));
        expect(await beanstalk.balanceOfStalk(user4.address)).to.eq(toStalk("0.2"));

        // call a sunrise with 100 beans.
        await mockBeanstalk.siloSunrise(to6("100"));

        // after this sunrise, user 3 and 4 should have 0.2 stalk worth of earned beans:
        // 0.2/2100.4 * 100
        checkMultipleEarnedBeans([
          [user, 9521],
          [user2, 9521]
        ]);

        // user 1 and 2 should have slightly less than 100 beans each.
        checkMultipleEarnedBeans([
          [user, to6("99.990478")],
          [user2, to6("99.990478")]
        ]);
      });

      it("correct earned beans values after multiple seasons elapsed", async function () {
        // verify whether the users get a correct amount of earned beans after multiple seasons elapsed.
        await mockBeanstalk.siloSunrise(to6("100"));
        await mockBeanstalk.siloSunrise(to6("100"));
        await mockBeanstalk.farmSunrises(100);

        checkMultipleEarnedBeans([
          [user, 126190476],
          [user2, 126190476],
          [user3, 23809523],
          [user4, 23809523]
        ]);

        await multiPlant([user, user2, user3, user4]);

        // verify new plants.
        checkMultipleNewPlants([
          [user, 126190476],
          [user2, 126190476],
          [user3, 23809523],
          [user4, 23809523]
        ]);
      });
    });
  });
});

function tryParseJSONObject(jsonString) {
  try {
    var o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
      return o;
    }
  } catch (e) {}

  return false;
}

// helper functions
async function checkMultipleEarnedBeans(data) {
  for (let i = 0; i < data.length; i++) {
    expect(await beanstalk.balanceOfEarnedBeans(data[i][0].address)).to.eq(data[i][1]);
  }
}

async function multiPlant(data) {
  for (let i = 0; i < data.length; i++) {
    await beanstalk.connect(data[i]).plant();
  }
}

async function getNewlyPlantedDeposit(user) {
  stem = await beanstalk.stemTipForToken(BEAN);
  return await beanstalk.getDeposit(user.address, BEAN, stem);
}

async function checkMultipleNewPlants(data) {
  for (let i = 0; i < data.length; i++) {
    const plantDeposit = getNewlyPlantedDeposit(data[i][0]);
    expect(plantDeposit[0]).to.eq(data[i][1]);
  }
}
