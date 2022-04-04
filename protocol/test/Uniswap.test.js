const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Uniswap', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)
    this.uniswap = await ethers.getContractAt('MockUniswapFacet', this.diamond.address);

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.pair.connect(user).approve(this.silo.address, '100000000000')
    await this.pair.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000')
    await this.weth.connect(user).approve(this.silo.address, '100000000000');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnWETH(this.weth.address);
    await this.pair.set('9000000', '10000','1');
    await this.season.siloSunrise(0)
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetWrappedBeans([userAddress, user2Address, ownerAddress])
    await this.season.resetState()
    await this.season.siloSunrise(0)
    await this.weth.mint(this.pair.address, '20000');
    await this.bean.mint(this.pair.address, '20000');
    await this.uniswap.resetInternalBalance(userAddress, this.weth.address);
    await this.uniswap.resetInternalBalance(userAddress, this.bean.address);
  });

  describe('Sanity Checks', function () {
    it('reverts when given an uneven amount of tokens to add liquidity', async function () {
	    await expect(this.uniswap.connect(user).addLiquidityOnUniswap('1', '1000', '980', '1'))
        .to.be.revertedWith('LibUniswap: INSUFFICIENT_B_AMOUNT');
    });
    it('reverts when asking for too many tokens on a swap', async function () {
	    await expect(this.uniswap.connect(user).swapOnUniswap(this.weth.address, '1000', '1001'))
        .to.be.revertedWith('UniswapV2: TRANSFER_FAILED');
    });
    it('reverts when a user has no liquidity to remove', async function () {
	    await expect(this.uniswap.connect(user).removeLiquidityOnUniswap('1', '980', '1'))
        .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });
  describe('Add Liquidity', function () {
   beforeEach(async function () {
	    await this.uniswap.connect(user).addLiquidityOnUniswap('1000', '1', '980', '1'); // TokenA(BEAN), TokenB(WETH), TokenAMin, TokenBMin
	    await this.uniswap.connect(user).addLiquidityETHOnUniswap('1000', '980', '1', {value: ethers.utils.parseEther('1')});
   });
   it('add liquidity to the pair', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).addLiquidityOnUniswap('1000', '1', '980', '1'); // TokenA(BEAN), TokenB(WETH), TokenAMin, TokenBMin
	    expect(await this.pair.balanceOf(userAddress)).to.eq('3');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq(-1000);
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq(-1)
   });
   it('add eth liquidity to the pair', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).addLiquidityETHOnUniswap('1000', '980', '1', {value: ethers.utils.parseEther('1')});
	    expect(await this.pair.balanceOf(userAddress)).to.eq('3');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq(-1000);
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('0') // ETH added
   });
   it('properly updates the user\'s LP tokens', async function () {
	    expect(await this.pair.balanceOf(userAddress)).to.eq('2');
   });
  });
  describe('Remove Liquidity', function () {
    beforeEach(async function () {
	    await this.uniswap.connect(user).addLiquidityOnUniswap('1000', '1', '980', '1');
	    await this.uniswap.connect(user).addLiquidityETHOnUniswap('1000', '980', '1', {value: ethers.utils.parseEther('1')});
    });
    it('remove liquidity from the pair', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).removeLiquidityOnUniswap('1', '980', '1');
	    expect(await this.pair.balanceOf(userAddress)).to.eq('1');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('11000'); // Values are high due to pair having excessive amount of weth/bean to begin with
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('10001')
    });
    it('remove eth liquidity from the pair', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).removeLiquidityETHOnUniswap('1', '980', '1');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('11000');
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('0');
    });
    it('properly updates the user\'s LP tokens', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).removeLiquidityOnUniswap('1', '980', '1');
	    await this.uniswap.connect(user).removeLiquidityETHOnUniswap('1', '980', '1');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('22000');
	    expect(await this.pair.balanceOf(userAddress)).to.eq('0')
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('10001')
    });
  });
  describe('Swap', async function () {
    beforeEach(async function () {
	    await this.pair.simulateTrade('20000', '20000');
	    await this.uniswap.connect(user).sellBeansOnUniswap('1000', '1'); // Simulating trade to ensure no "beforeEach" function reverts
	    await this.uniswap.connect(user).buyBeansOnUniswap('940', {value: '1000' });
    });
    it('properly performs swapExactTokensForTokens', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.uniswap.connect(user).sellBeansOnUniswap('1000', '1');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('-51');  // Testing two things: Automatically taking from InternalBalance and correct decrement => 1000 - 949 = 51
	    expect(await this.claim.wrappedBeans(userAddress)).to.eq('0');
	    expect(await this.uniswap.internalBalance(userAddress, this.weth.address)).to.eq('1898');	
    });
    it('properly performs swapExactETHForTokens', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.uniswap.connect(user).buyBeansOnUniswap('940', {value: '1000'});
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('0');  // From here on, entire swap should be funded by internal balance
	    expect(await this.claim.wrappedBeans(userAddress)).to.eq('1898');	
	    expect(await this.uniswap.internalBalance(userAddress, this.weth.address)).to.eq('949');	
    });
    it('properly performs a specific token swap on Uniswap: WETH -> BEAN', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.uniswap.connect(user).swapOnUniswap(this.weth.address, '1000', '940');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('0');
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('-51');
	    expect(await this.claim.wrappedBeans(userAddress)).to.eq('1898');	
	    expect(await this.uniswap.internalBalance(userAddress, this.weth.address)).to.eq('0');	
    });	
  });
});
