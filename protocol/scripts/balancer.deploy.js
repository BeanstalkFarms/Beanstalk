// Contracts
const VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const WEIGHTED_POOL_FACTORY = '0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// Beanstalk Silo Address
const OWNER_ADDRESS = '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'; 

// Tokens -- MUST be sorted numerically
const SEED = '0x0000000000000000000000000000000000000000';
const STALK = '0x0000000000000000000000000000000000000000';
const BEAN = '0xdc59ac4fefa32293a95889dc396682858d52e5db';
const tokens = [SEED, STALK, BEAN];

const NAME = 'Three-Token Bean, Stalk, Seeds Test Pool';
const SYMBOL = '33SEED-33STALK-34Bean';
const swapFeePercentage = 0.005e18; // 0.5%
const weights = [0.33e18, 0.33e18, 0.34e18];

async function main() {

  async function createBalancerPool() {
    const factory = await ethers.getContractAt('WeightedPoolFactory',
                                            WEIGHTED_POOL_FACTORY);

    // If you're creating a different type of pool, look up the create 
    // function for your corresponding pool in that pool factory's ABI
    const tx = await factory.create(NAME, SYMBOL, tokens, weights,
                                    swapFeePercentage, OWNER_ADDRESS);
    const receipt = await tx.wait();

    // We need to get the new pool address out of the PoolCreated event
    const events = receipt.events.filter((e) => e.event === 'PoolCreated');
    const poolAddress = events[0].args.pool;

    // We're going to need the PoolId later, so ask the contract for it
    const pool = await ethers.getContractAt('WeightedPool', poolAddress);
    const poolId = await pool.getPoolId();

  }

  async function addTokens() {
    const vault = await ethers.getContractAt('Vault', VAULT);

    // Tokens must be in the same order
    // Values must be decimal-normalized! (USDT has 6 decimals)
    // Seeds and Beans have 6 decimals and Stalk has 10
    const initialBalances = [8000e6, 8000e10, 8000e6];

    // Need to approve the Vault to transfer the tokens!
    // Can do through Etherscan, or programmatically
    for (var i in tokens) {
      const tokenContract = await ethers.getContractAt('ERC20', tokens[i]);
      await tokenContract.approve(VAULT, initialBalances[i]);
    }
  }

  async function joinBalancerPool() {
    // Construct userData
    const JOIN_KIND_INIT = 0;
    const initUserData =
        ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                            [JOIN_KIND_INIT, initialBalances]);

    const joinPoolRequest = {
      assets: tokens,
      maxAmountsIn: initialBalances,
      userData: initUserData,
      fromInternalBalance: false
    } 

    // define caller as the address you're calling from
    // Beanstalk Silo Contract Address
    caller = '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5';

    // joins are done on the Vault
    const tx = await vault.joinPool(poolId, caller, caller, joinPoolRequest);

    // You can wait for it like this, or just print the tx hash and monitor
    const receipt = await tx.wait();
  }

  createBalancerPool();
  addTokens();
  joinBalancerPool();

}

main();