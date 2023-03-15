const beanstalkABI = require('../abi/Beanstalk.json');
const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const hre = require('hardhat');
const { impersonateBeanstalkOwner, mintEth } = require('../utils');
const fs = require('node:fs');

async function main() {
  const seasonFacet = await hre.ethers.getContractAt(
    'SeasonFacet',
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
  );

  const START_BLOCK = 16143379;

  const events = await seasonFacet.queryFilter(
    'Sunrise(uint256)',
    START_BLOCK,
    'latest'
  );

  const beanstalk = await hre.ethers.getContractAt(
    beanstalkABI,
    '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5'
  );

  let csvContent =
    'TX_HASH,GAS_USED,GAS_PRICE,GAS_COST,GAS_COST_IN_DOLLARS,BEAN_AMOUNT\n';

  for (let i = 0; i < 10; i++) {
    // fetch eth price from uniswap pool

    const ethPrice = await getETHPrice();

    const event = events[i];
    const txHash = event.transactionHash;
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const [beanTransfer] = receipt.logs.filter((log) => {
      return (
        log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
        hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
          log.topics[2]
      );
    });

    const beanAmount = parseInt(beanTransfer?.data, 16);

    csvContent +=
      receipt.transactionHash +
      ',' +
      gasUsed +
      ',' +
      gasPrice +
      ',' +
      gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
      ',' +
      ethPrice * gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
      ',' +
      beanAmount +
      '\n';
  }

  csvContent += '\n"AFTER UPGRADE"\n\n';

  for (let i = 0; i < 10; i++) {
    const ethPrice = await getETHPrice();

    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp / 3600 + 1) * 3600;
    await network.provider.send('evm_setNextBlockTimestamp', [hourTimestamp]);

    const account = await impersonateBeanstalkOwner();
    await mintEth(account.address);

    await upgradeWithNewFacets({
      diamondAddress: beanstalk.address,
      facetNames: ['SeasonFacet'],
      bip: false,
      object: false,
      verbose: true,
      account: account,
    });

    const [signer] = await hre.ethers.getSigners();
    const sunrise = await beanstalk.connect(signer).sunrise();
    sunrise.wait().then((receipt) => {
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const [beanTransfer] = receipt.logs.filter((log) => {
        return (
          log.address === '0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab' &&
          hre.ethers.utils.hexZeroPad(receipt.from.toLowerCase(), 32) ===
            log.topics[2]
        );
      });

      const beanAmount = parseInt(beanTransfer?.data, 16);

      csvContent +=
        receipt.transactionHash +
        ',' +
        gasUsed +
        ',' +
        gasPrice +
        ',' +
        gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
        ',' +
        ethPrice * gasUsed * ethers.utils.formatUnits(gasPrice, 'ether') +
        ',' +
        beanAmount +
        '\n';
    });
  }

  try {
    fs.writeFileSync('./sunrise_simulate.csv', csvContent);
    console.log('Data written to file successfully.');
  } catch (err) {
    console.error('Failed to write to file: ' + err);
    throw err;
  }
}

async function getETHPrice() {
  const usdcWethPool = await ethers.getContractAt(
    'IUniswapV3Pool',
    '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
  );

  const slot0 = await usdcWethPool.slot0();
  const sqrtPriceX96 = slot0[0];
  const Q96 = hre.ethers.BigNumber.from(2).pow(96);

  const quotientP =
    ethers.BigNumber.from(1).mul(10).pow(18).div(sqrtPriceX96.div(Q96).pow(2)) /
    ethers.BigNumber.from(10).pow(18);

  const ethPrice = quotientP * 10 ** 12;
  return ethPrice;
}

main();
