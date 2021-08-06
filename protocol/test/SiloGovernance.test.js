const hre = require("hardhat")
const { BN, expectRevert } = require("@openzeppelin/test-helpers")
const { deploy } = require('../scripts/deploy.js')
const { upgradeWithNewFacets } = require('../scripts/diamond.js')
const { BigNumber } = require('bignumber.js')
const { expect } = require('chai')
const { printTestCrates } = require('./utils/print.js')
const { parseJson, incrementTime } = require('./utils/helpers.js')
const { ZERO_ADDRESS, MAX_UINT256 } = require('./utils/constants.js')

// Set the test data
const [columns, tests] = parseJson('./coverage_data/siloGovernance.json')
var numberTests = tests.length
var startTest = 0

const users = ['userAddress', 'user2Address', 'ownerAddress', 'otherAddress']

async function propose(g,user,bip,p=0) {
  return await g.connect(user).propose(bip.diamondCut, bip.initFacetAddress, bip.functionCall, p)
}

async function checkUserCrates(silo, userName, address, data) {
    var crates = data.beanDeposits[userName]
    await silo.updateSilo(address)
    for (var i = 0; i < crates.length; i++) {
      expect(await silo.beanDeposit(address, crates[i][0])).to.eq(crates[i][1])
    }
    crates = data.LPDeposits[userName]
    for (var i = 0; i < crates.length; i++) {
      const crate = await silo.lpDeposit(address, crates[i][0])
      expect(crate[0]).to.eq(crates[i][1])
      expect(crate[1]).to.eq(crates[i][2])
    }
    crates = data.beanTransitDeposits[userName]
    for (var i = 0; i < crates.length; i++) {
      expect(await silo.beanWithdrawal(address, crates[i][0])).to.eq(crates[i][1])
    }
    crates = data.LPTransitDeposits[userName]
    for (var i = 0; i < crates.length; i++) {
      expect(await silo.lpWithdrawal(address, crates[i][0])).to.eq(crates[i][1])
    }
}

describe('Silo', function () {

  before(async function () {
    [owner,user,user2,other, weth] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    otherAddress = other.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.claim = await ethers.getContractAt('ClaimFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    this.governance = await ethers.getContractAt('MockGovernanceFacet', this.diamond.address)
    const wethAddress = this.silo.weth()
    this.weth = await ethers.getContractAt('MockWETH', wethAddress)
    weth.sendTransaction({
      to: wethAddress,
      value: ethers.utils.parseEther('500')
    })

    empty = {
      diamondCut: [],
      initFacetAddress: ZERO_ADDRESS,
      functionCall: '0x'
    }

    cut = await upgradeWithNewFacets ({
      diamondAddress: this.diamond.address,
      facetNames: ['MockUpgradeFacet'],
      selectorsToRemove: [],
      initFacetName: 'MockUpgradeInitDiamond',
      initArgs: [],
      object: true,
      verbose: false,
    })
  });

  [...Array(numberTests).keys()].map(i => i + startTest).forEach(function(v) {
    const testStr = 'Test #'
    describe(testStr.concat((v)), function () {
      testData = {}
      tests[v]
      columns.forEach((key, i) => testData[key] = tests[v][i])
      before(async function () {
        this.testData = {}
        columns.forEach((key, i) => this.testData[key] = tests[v][i])
        for (c in columns) {
          if (typeof this.testData[columns[c]] == 'number') {
             this.testData[columns[c]] = this.testData[columns[c]].toString()
          }
        }

        // console.log(this.testData)

        await this.season.resetAccount(userAddress)
        await this.season.resetAccount(user2Address)
        await this.season.resetAccount(otherAddress)
        await this.season.resetState()
        await this.season.teleportSunrise(this.testData.startingSeason)
        await this.field.resetAllowances([userAddress, user2Address, otherAddress, ownerAddress])
        await this.bean.connect(user).burn(await this.bean.balanceOf(userAddress))
        await this.bean.connect(user2).burn(await this.bean.balanceOf(user2Address))
        await this.bean.connect(other).burn(await this.bean.balanceOf(otherAddress))

        await this.pair.burnAllLP(this.silo.address)
        await this.pair.burnAllLP(userAddress)
        await this.pair.burnAllLP(user2Address)
        await this.pair.burnAllLP(otherAddress)
        await this.pair.simulateTrade(this.testData.pooledBeans, this.testData.pooledETH)
        await this.pegPair.setReserves(10000, 1000)
        await this.bean.mint(userAddress, this.testData.userBeans)
        await this.bean.connect(user).approve(this.silo.address, MAX_UINT256)
        await this.bean.mint(user2Address, this.testData.user2Beans)
        await this.bean.connect(user2).approve(this.silo.address, MAX_UINT256)
        await this.bean.mint(otherAddress, this.testData.otherBeans)
        await this.bean.connect(other).approve(this.silo.address, MAX_UINT256)
        await this.pair.faucet(userAddress, this.testData.userLP)
        await this.pair.connect(user).approve(this.silo.address, MAX_UINT256)
        await this.pair.faucet(user2Address, this.testData.user2LP)
        await this.pair.connect(user2).approve(this.silo.address, MAX_UINT256)
        await this.pair.faucet(otherAddress, this.testData.otherLP)
        await this.pair.connect(other).approve(this.silo.address, MAX_UINT256)

        for (var i = 0; i < this.testData.functionsCalled.length; i++) {
          this.testData.functionsCalled[i] = this.testData.functionsCalled[i].replace('Address','')
          // if (this.testData.functionsCalled[i].substring(0,6) !== 'expect') console.log('\t' + this.testData.functionsCalled[i])
          this.result = await eval(this.testData.functionsCalled[i])
        }

      })
      it('updates user\'s silo balances', async function () {
        expect(await this.pair.balanceOf(userAddress)).to.eq(this.testData.userCirculatingLP)
        expect(await this.silo.balanceOfSeeds(userAddress)).to.eq(this.testData.userTotalSeeds)
        expect(await this.silo.balanceOfStalk(userAddress)).to.eq(this.testData.userTotalStalk)
        expect(await this.silo.balanceOfIncrease(userAddress)).to.eq(this.testData.userUnclaimedBeans)
        expect(await this.silo.balanceOfDepositedBeans(userAddress)).to.eq(this.testData.userTotalSiloBeans)
        expect(await this.silo.balanceOfDepositedLP(userAddress)).to.eq(this.testData.userLPInSilo)
        const rewardedStalk = new BigNumber(await this.silo.balanceOfRewardedStalk(userAddress))
        const increaseStalk = new BigNumber(await this.silo.balanceOfIncreaseStalk(userAddress))
        expect(rewardedStalk.plus(increaseStalk).toString()).to.eq(this.testData.userRewardedStalk)
      })

      it('updates user\'s crates', async function () {
        await checkUserCrates(this.silo, 'user', userAddress, this.testData)
      })

      it('updates user2\'s bean balances', async function () {
        expect(await this.bean.balanceOf(user2Address)).to.eq(this.testData.user2CirculatingBeans)
        expect(await this.pair.balanceOf(user2Address)).to.eq(this.testData.user2CirculatingLP)
        expect(await this.silo.balanceOfStalk(user2Address)).to.eq(this.testData.user2TotalStalk)
        expect(await this.silo.balanceOfSeeds(user2Address)).to.eq(this.testData.user2TotalSeeds)
        expect(await this.silo.balanceOfIncrease(user2Address)).to.eq(this.testData.user2UnclaimedBeans)
        expect(await this.silo.balanceOfDepositedBeans(user2Address)).to.eq(this.testData.user2TotalSiloBeans)
        expect(await this.silo.balanceOfDepositedLP(user2Address)).to.eq(this.testData.user2LPInSilo)
        const rewardedStalk = new BigNumber(await this.silo.balanceOfRewardedStalk(user2Address))
        const increaseStalk = new BigNumber(await this.silo.balanceOfIncreaseStalk(user2Address))
        expect(rewardedStalk.plus(increaseStalk).toString()).to.eq(this.testData.user2RewardedStalk)
      })

      it('updates user2\'s crates', async function () {
        await checkUserCrates(this.silo, 'user2', user2Address, this.testData)
      })

      it('updates other\'s bean balances', async function () {
        expect(await this.bean.balanceOf(otherAddress)).to.eq(this.testData.otherCirculatingBeans)
        expect(await this.pair.balanceOf(otherAddress)).to.eq(this.testData.otherCirculatingLP)
        expect(await this.silo.balanceOfStalk(otherAddress)).to.eq(this.testData.otherTotalStalk)
        expect(await this.silo.balanceOfSeeds(otherAddress)).to.eq(this.testData.otherTotalSeeds)
        expect(await this.silo.balanceOfIncrease(otherAddress)).to.eq(this.testData.otherUnclaimedBeans)
        expect(await this.silo.balanceOfDepositedBeans(otherAddress)).to.eq(this.testData.otherTotalSiloBeans)
        expect(await this.silo.balanceOfDepositedLP(otherAddress)).to.eq(this.testData.otherLPInSilo)
        const rewardedStalk = new BigNumber(await this.silo.balanceOfRewardedStalk(otherAddress))
        const increaseStalk = new BigNumber(await this.silo.balanceOfIncreaseStalk(otherAddress))
        expect(rewardedStalk.plus(increaseStalk).toString()).to.eq(this.testData.otherRewardedStalk)
      })

      it('updates other\'s crates', async function () {
        await checkUserCrates(this.silo, 'other', otherAddress, this.testData)
      })
      //
      it('updates total balances', async function () {
        expect(await this.bean.balanceOf(this.silo.address)).to.eq((new BN(this.testData.totalSiloBeans)).add(new BN(this.testData.totalTransitBeans)).toString())
        expect(await this.silo.totalDepositedBeans()).to.eq(this.testData.totalSiloBeans)
        expect(await this.silo.totalWithdrawnBeans()).to.eq(this.testData.totalTransitBeans)
        expect(await this.pair.balanceOf(this.silo.address)).to.eq((new BN(this.testData.totalLPInSilo)).add(new BN(this.testData.totalTransitLP)).toString())
        expect(await this.silo.totalDepositedLP()).to.eq(this.testData.totalLPInSilo)
        expect(await this.silo.totalWithdrawnLP()).to.eq(this.testData.totalTransitLP)

        expect(await this.silo.totalStalk()).to.eq(this.testData.totalStalk)
        expect(await this.silo.totalSeeds()).to.eq(this.testData.totalSeeds)
      })

      it ('updates the sop balances', async function () {
        const userBase = await this.silo.balanceOfPlentyBase(userAddress)
        const user2Base = await this.silo.balanceOfPlentyBase(user2Address)
        const otherBase = await this.silo.balanceOfPlentyBase(otherAddress)
        const totalUser = userBase.add(user2Base).add(otherBase)
        const sops = await this.silo.seasonsOfPlenty()
        expect(sops.base.toString()).to.eq(totalUser.toString())
        expect(await this.weth.balanceOf(this.silo.address)).to.eq(sops.weth.toString())
      })

      it('updates weth after claim', async function () {
        for (let i = 0; i < users.length; i++) {
          const uAddress = eval(users[i])
          const u = eval(users[i].replace('Address',''))
          const weth = await this.silo.balanceOfEth(uAddress)
          if (weth.gt(0)) {
            const beforeEth = await ethers.provider.getBalance(uAddress)
            await this.claim.connect(u).claimEth()
            const afterEth = await ethers.provider.getBalance(uAddress)
            expect(weth.toString()).to.eq(afterEth.sub(beforeEth).toString())
          }
        }
        const sops = await this.silo.seasonsOfPlenty()
        expect(sops.base).to.eq('0')
        expect(sops.weth).to.eq('0')
        expect(await this.weth.balanceOf(this.silo.address)).to.eq('0')
      })

      it('pauses or unpauses the system', async function () {
        expect(await this.season.paused()).to.eq(this.testData.Paused)
      })

      it('Property updates the bips', async function () {
        expect((await this.governance.numberOfBips()).toString()).to.eq(this.testData.bipIndex)
        for (var i = 0; i < this.testData.bips.length; i++) {
          const bipData = this.testData.bips[i]
          const bipId = bipData[0]
          const bip = await this.governance.bip(bipId)
          expect(bip.proposer).to.eq(eval(bipData[5]))
          expect(bip.seeds).to.eq(bipData[7])
          expect(bip.stalk).to.eq(bipData[6])
          expect(bip.increaseBase).to.eq(bipData[8])
          expect(bip.stalkBase).to.eq(bipData[9])
          expect(bip.updated.toString()).to.eq(bipData[1])
          expect(bip.start.toString()).to.eq(bipData[2])
          expect(bip.period.toString()).to.eq(bipData[3])
          expect(bip.executed).to.eq(bipData[11])
          expect(bip.pauseOrUnpause).to.eq(bipData[12])
          expect(bip.endTotalStalk).to.eq(bipData[13])
        }
      })

      it('Properly has has the voters voted', async function () {
        for (var i = 0; i < this.testData.bips.length; i++) {
          const bipVoters = this.testData.bips[i][10]
          const bipId = this.testData.bips[i][0]
          for (var j = 0; j < users.length; j++) {
            expect(await this.governance.voted(eval(users[j]), bipId)).to.eq(bipVoters.includes(users[j]))
          }
        }
      })

      it('Props lists the active bips', async function () {
        const activeBipData = this.testData.activeBIPS.map((b) => b[0]).sort()
        const activeBips = (await this.governance.activeBips()).map((b) => b.toString()).sort()
        for (var i = 0; i < this.testData.activeBIPS.length; i++) {
          expect(activeBipData[i]).to.eq(activeBips[i])
        }
      })

    })
  })
})
