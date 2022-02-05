const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Impersonate', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);

    let json = fs.readFileSync(`./artifacts/contracts/mocks/MockToken.sol/MockToken.json`);
    json = JSON.parse(json);

    await network.provider.send("hardhat_setCode", [
        "0xDC59ac4FeFa32293A95889Dc396682858d52e5Db",
        json.deployedBytecode,
    ]);

    this.testBean = await ethers.getContractAt('MockToken', '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db')
    console.log(await this.testBean.decimals())

    this.claim = await ethers.getContractAt('MockClaimFacet', '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db')
      

    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)

    await this.pair.simulateTrade('2000', '2');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
    await this.pair.faucet(userAddress, '1');
    await this.pair.faucet(user2Address, '1');
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('BDV', function () {
    describe('single BDV', function () {
  
      it('properly retrieves Uniswap BDV', async function () {
        const bdv = await this.silo.callStatic.getUniswapBDV(this.pair.address, '1')
        expect(bdv).to.be.equal('2000');
      });
  
    });
  });
});
