const { expect } = require("chai");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const { BEANSTALK } = require("./utils/constants");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js')
const { mintEth } = require('../utils/mint.js')
const { upgradeWithNewFacets } = require("../scripts/diamond");


describe("Legacy Claim", async function () {
  before(async function () {
    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 16993151 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            }
          }
        ]
      });
    } catch (error) {
      console.log("forking error in Legacy Claim");
      console.log(error);
      return;
    }

    const signer = await impersonateBeanstalkOwner();
    await mintEth(signer.address);
    await upgradeWithNewFacets({
      diamondAddress: BEANSTALK,
      facetNames: [
        "LegacyClaimWithdrawalFacet"
      ],
      // libraryNames: ['LibLegacyTokenSilo'],
      initFacetName: "InitBipNewSilo",
      bip: false,
      object: false,
      verbose: false,
      account: signer
    });



    this.diamond = BEANSTALK;

    // this.season = await ethers.getContractAt("MockSeasonFacet", this.diamond);

    this.silo = await ethers.getContractAt("MockSiloFacet", this.diamond);
    // this.legacyClaim = await ethers.getContractAt("LegacyClaimWithdrawalFacet", this.diamond);


  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("claim", async function () {
    //test claim of several that are already in-flight on chain

    before(async function () {
      /*
            //graph ql query like this:
            {
                siloWithdraws(where: {claimed: false}, orderBy: amount, orderDirection: desc) {
                    amount
                    claimed
                    token
                    farmer {
                    id
                    }
                    withdrawSeason
                }
            }
            */

      this.withdraws = [
        {
          "amount": "2199303350630125241262",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x7aaee144a14ec3ba0e468c9dcf4a89fdb62c5aa6"
          },
          "withdrawSeason": 7486
        },
        {
          "amount": "815698295783993606560",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x90fe1ad4f312dcce621389fc73a06dccfd923211"
          },
          "withdrawSeason": 6115
        },
        {
          "amount": "388378682665110753064",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x4465c4474703bb199c6ed15c97b6e32bd211cf9d"
          },
          "withdrawSeason": 8857
        },
        {
          "amount": "246184929763052683491",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0xe203096d7583e30888902b2608652c720d6c38da"
          },
          "withdrawSeason": 11785
        },
        {
          "amount": "223773445276300554417",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x9260ae742f44b7a2e9472f5c299aa0432b3502fa"
          },
          "withdrawSeason": 6100
        },
        {
          "amount": "143973934763918324552",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x941169fff3c353be965e3f34823eea63b772219c"
          },
          "withdrawSeason": 8011
        },
        {
          "amount": "43343943302178465210",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x3df37474ffb9969857cefe902b35658ba925d00f"
          },
          "withdrawSeason": 6896
        },
        {
          "amount": "18424051885562627867",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0x33926984172ec1365587987f6b923b4330008154"
          },
          "withdrawSeason": 8879
        },
        {
          "amount": "1000000000000000000",
          "claimed": false,
          "token": "0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49",
          "farmer": {
            "id": "0xd130ab894366e4376b1afe3d52638a1087be17f4"
          },
          "withdrawSeason": 7191
        }
      ];

      //make token/farmer.id real addresses
      for (var i = 0; i < this.withdraws.length; i++) {
        const withdraw = this.withdraws[i];
        withdraw.token = ethers.utils.getAddress(withdraw.token);
        withdraw.farmer.id = ethers.utils.getAddress(withdraw.farmer.id);
      }

      this.results = [];
      this.userTokensBefore = [];
      this.deltaTokens = [];
      this.totalWithdrawnBefore = [];
      this.totalWithdrawnAfter = [];
      this.legacyClaims = [];

      //loop through withdraws
      for (var i = 0; i < this.withdraws.length; i++) {
        const withdraw = this.withdraws[i];
        const depositorSigner = await impersonateSigner(withdraw.farmer.id);
        mintEth(depositorSigner.address); //make sure they have enough eth to send tx
        // console.log("depositorSigner: ", depositorSigner);

        var claim = await ethers.getContractAt("LegacyClaimWithdrawalFacet", this.diamond);
        claim = claim.connect(depositorSigner);
        this.legacyClaims[i] = claim;

        const thisToken = await ethers.getContractAt("IERC20", withdraw.token);

        this.userTokensBefore[i] = await thisToken.balanceOf(withdraw.farmer.id);
        this.totalWithdrawnBefore[i] = await claim.getTotalWithdrawn(thisToken.address);

        this.results[i] = await this.legacyClaims[i]
          .connect(depositorSigner)
          .claimWithdrawal(withdraw.token, withdraw.withdrawSeason, EXTERNAL);

        this.totalWithdrawnAfter[i] = await claim.getTotalWithdrawn(thisToken.address);

        this.deltaTokens[i] = (await thisToken.balanceOf(withdraw.farmer.id)).sub(this.userTokensBefore[i]);
      }
    });

    it("properly updates the total balances", async function () {
      for (var i = 0; i < this.withdraws.length; i++) {
        const withdraw = this.withdraws[i];
        const thisToken = await ethers.getContractAt("IERC20", withdraw.token);
        const diff = this.totalWithdrawnBefore[i].sub(this.totalWithdrawnAfter[i]);
        expect(diff == withdraw.amount);
        expect(this.deltaTokens[i]).to.equal(withdraw.amount);
      }
    });

    it("properly removes the withdrawal", async function () {
      for (var i = 0; i < this.withdraws.length; i++) {
        const withdraw = this.withdraws[i];
        expect(await this.legacyClaims[i].getWithdrawal(withdraw.farmer.id, withdraw.token, withdraw.withdrawSeason)).to.eq("0");
      }
    });

    it("emits a RemoveWithdrawal event", async function () {
      for (var i = 0; i < this.withdraws.length; i++) {
        const withdraw = this.withdraws[i];

        await expect(this.results[i]).to.emit(this.silo, "RemoveWithdrawal").withArgs(ethers.utils.getAddress(withdraw.farmer.id), ethers.utils.getAddress(withdraw.token), withdraw.withdrawSeason, withdraw.amount);
      }
    });
  });

});
