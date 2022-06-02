const { expect } = require("chai");
const { deployFertilizer } = require('../scripts/deployFertilizer.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
require('dotenv').config();
const ALCHEMY_URL = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`

let user, user2;

const BF = '0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7'

function to18(a) {
  return ethers.utils.parseEther(a)
}

function to6(a) {
  return ethers.utils.parseUnits(a, 6)
}

async function reset() {
  await network.provider.request({
    method: "hardhat_reset",
    params: [{
        forking: {
          jsonRpcUrl: ALCHEMY_URL,
          blockNumber: 14602789,
        },
      },],
  });
}

describe("PreFertilizer", function () {
  before(async function () {
    await reset();
    [user, user2] = await ethers.getSigners();
    this.fertilizer = await deployFertilizer(user, true, true);
    this.usdc = await ethers.getContractAt("IUSDC", await this.fertilizer.USDC())
    await this.usdc.connect(user).approve(this.fertilizer.address, to18('1000'))

    await expect(this.fertilizer.connect(user).mint(to6('10000'))).to.be.revertedWith('Fertilizer: Not started')
    await network.provider.send("evm_setNextBlockTimestamp", [1654531200])
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it('reverts on balance of 0', async function () {
    await expect(this.fertilizer.balanceOf(ethers.constants.AddressZero, to6('6'))).to.be.revertedWith('ERC1155: balance query for the zero address')
    await expect(this.fertilizer.lastBalanceOf(ethers.constants.AddressZero, to6('6'))).to.be.revertedWith('ERC1155: balance query for the zero address')
  })

  describe("Below Remaining", async function () {
    describe("Contribute from usdc", async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(user).mint(to6('10000'))
      })

      it('changes user balance', async function () {
        expect(await this.fertilizer.balanceOf(user.address, to6('6'))).to.equal('10000')
        expect(await this.usdc.balanceOf(BF)).to.equal(to6('10000'))
        expect(await this.usdc.balanceOf(user.address)).to.equal(to6('0'))
        const lb = await this.fertilizer.lastBalanceOf(user.address, to6('6'))
        expect(lb[0]).to.be.equal('10000')
        expect(lb[1]).to.be.equal(0)
      })

      it('changes total balance', async function () {
        expect(await this.fertilizer.remaining()).to.equal(to6('76990000'))
      })
    })

    describe("Contribute from eth", async function () {
      beforeEach(async function () {
        const ethIn = ethers.utils.parseEther('0.01')
        this.usdcOut = await this.fertilizer.callStatic.getUsdcOut(ethIn)
        usdcOutSlippage = await this.fertilizer.callStatic.getUsdcOutWithSlippage(ethIn, '10')
        await this.fertilizer.buyAndMint(usdcOutSlippage, {value: ethIn})
      })

      it('changes user balance', async function () {
        expect(await this.fertilizer.balanceOf(user.address, to6('6'))).to.equal(this.usdcOut.div(1e6))
        expect(await this.usdc.balanceOf(BF)).to.equal(this.usdcOut)
      })
    })
  })

  describe('Above remaining', async function () {
    beforeEach(async function () {
      usdc_minter = '0x5B6122C109B78C6755486966148C1D70a50A47D7'
      const minter = await ethers.getSigner(usdc_minter)
      await this.usdc.connect(minter).mint(BF, ethers.utils.parseUnits('76999999',6));
    })

    describe("Contribute from usdc", async function () {
      beforeEach(async function () {
        await this.fertilizer.connect(user).mint(to6('10000'))
      })
  
      it('changes user balance', async function () {
        expect(await this.fertilizer.balanceOf(user.address, to6('6'))).to.equal('1')
        expect(await this.usdc.balanceOf(BF)).to.equal(to6('77000000'))
        expect(await this.usdc.balanceOf(user.address)).to.equal(to6('9999'))
      })
  
      it('changes total balance', async function () {
        expect(await this.fertilizer.remaining()).to.equal(to6('0'))
      })
    })
    

    describe("Contribute from eth", async function () {
      it('reverts', async function () {
        const ethIn = ethers.utils.parseEther('0.01')
        await expect(this.fertilizer.buyAndMint('0', {value: ethIn})).to.be.revertedWith('Fertilizer: Not enough remaining')
      })
    })
  })

  describe("Transfer", async function () {
    it('revert if not enough', async function () {
      await expect(this.fertilizer.safeTransferFrom(user.address, user.address, to6('6'), '10001', ethers.constants.HashZero))
        .to.be.revertedWith("ERC1155: insufficient balance for transfer")
    })

    it('works if enough', async function () {
      await this.fertilizer.connect(user).mint(to6('10000'))
      await this.fertilizer.safeTransferFrom(user.address, user2.address, to6('6'), '1000', ethers.constants.HashZero)
      expect(await this.fertilizer.balanceOf(user.address, to6('6'))).to.equal('9000')
      expect(await this.fertilizer.balanceOf(user2.address, to6('6'))).to.equal('1000')
    })

    it('batch works if enough', async function () {
      await this.fertilizer.connect(user).mint(to6('10000'))
      await this.fertilizer.safeBatchTransferFrom(user.address, user2.address, [to6('6')], ['1000'], ethers.constants.HashZero)
      expect(await this.fertilizer.balanceOf(user.address, to6('6'))).to.equal('9000')
      expect(await this.fertilizer.balanceOf(user2.address, to6('6'))).to.equal('1000')
    })

  })
})
