const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

const diamond = require('./diamond.js')
const { 
  impersonateBean, 
  impersonateCurve,
  impersonateCurveMetapool, 
  impersonateWeth, 
  impersonateUnripe, 
  impersonateFertilizer,
  impersonatePrice
} = require('./impersonate.js')
function addCommas(nStr) {
  nStr += ''
  const x = nStr.split('.')
  let x1 = x[0]
  const x2 = x.length > 1 ? '.' + x[1] : ''
  var rgx = /(\d+)(\d{3})/
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2')
  }
  return x1 + x2
}

function strDisplay(str) {
  return addCommas(str.toString())
}

async function main(scriptName, verbose = true, mock = false, reset = true) {
  if (verbose) {
    console.log('SCRIPT NAME: ', scriptName)
    console.log('MOCKS ENABLED: ', mock)
  }

  if (mock && reset) {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  }

  const accounts = await ethers.getSigners()
  const account = await accounts[0].getAddress()
  if (verbose) {
    console.log('Account: ' + account)
    console.log('---')
  }
  let tx
  let totalGasUsed = ethers.BigNumber.from('0')
  let receipt
  const name = 'Beanstalk'


  async function deployFacets(verbose,
    facets,
    libraryNames = [],
    facetLibraries = {},
  ) {
    const instances = []
    const libraries = {}

    for (const name of libraryNames) {
      if (verbose) console.log(`Deploying: ${name}`)
      let libraryFactory = await ethers.getContractFactory(name)
      libraryFactory = await libraryFactory.deploy()
      await libraryFactory.deployed()
      const receipt = await libraryFactory.deployTransaction.wait()
      if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed))
      if (verbose) console.log(`Deployed at ${libraryFactory.address}`)
      libraries[name] = libraryFactory.address
    }

    for (let facet of facets) {
      let constructorArgs = []
      if (Array.isArray(facet)) {
        ;[facet, constructorArgs] = facet
      }
      let factory;
      if (facetLibraries[facet] !== undefined) {
        let facetLibrary = Object.keys(libraries).reduce((acc, val) => {
          if (facetLibraries[facet].includes(val)) acc[val] = libraries[val];
          return acc;
        }, {});
        factory = await ethers.getContractFactory(facet, {
          libraries: facetLibrary
        },
        );
      } else {
        factory = await ethers.getContractFactory(facet)
      }
      const facetInstance = await factory.deploy(...constructorArgs)
      await facetInstance.deployed()
      const tx = facetInstance.deployTransaction
      const receipt = await tx.wait()
      if (verbose) console.log(`${facet} deploy gas used: ` + strDisplay(receipt.gasUsed))
      totalGasUsed = totalGasUsed.add(receipt.gasUsed)
      instances.push(facetInstance)
    }
    return instances
  }
  let [
    bdvFacet,
    curveFacet,
    convertFacet,
    farmFacet,
    fieldFacet,
    fundraiserFacet,
    marketplaceFacet,
    ownershipFacet,
    pauseFacet,
    seasonFacet,
    siloFacet,
    fertilizerFacet,
    tokenFacet,
    unripeFacet,
    whitelistFacet
  ] = mock ? await deployFacets(
    verbose,
    [ 'BDVFacet',
      'CurveFacet',
      'MockConvertFacet',
      'FarmFacet',
      'MockFieldFacet',
      'MockFundraiserFacet',
      'MockMarketplaceFacet',
      'PauseFacet',
      'MockSeasonFacet',
      'MockSiloFacet',
      'MockFertilizerFacet',
      'OwnershipFacet',
      'TokenFacet',
      'MockUnripeFacet',
      'WhitelistFacet'],
  ) : await deployFacets(
    verbose,
    [ 'BDVFacet',
      'CurveFacet',
      'ConvertFacet',
      'FarmFacet',
      'FieldFacet',
      'FundraiserFacet',
      'MarketplaceFacet',
      'OwnershipFacet',
      'PauseFacet',
      'SeasonFacet',
      'SiloFacet',
      'FertilizerFacet',
      'TokenFacet',
      'UnripeFacet',
      'WhitelistFacet'],
  )
  const initDiamondArg = mock ? 'contracts/mocks/MockInitDiamond.sol:MockInitDiamond' : 'contracts/farm/init/InitDiamond.sol:InitDiamond'
  // eslint-disable-next-line no-unused-vars

  let args = []
  if (mock) {
    await impersonateBean()
    await impersonatePrice()
    if (reset) {
      await impersonateCurve()
      await impersonateWeth()
    }
    await impersonateCurveMetapool()
    await impersonateUnripe()
    await impersonateFertilizer()
  }

  const [beanstalkDiamond, diamondCut] = await diamond.deploy({
    diamondName: 'BeanstalkDiamond',
    initDiamond: initDiamondArg,
    facets: [
      ['BDVFacet', bdvFacet],
      ['CurveFacet', curveFacet],
      ['ConvertFacet', convertFacet],
      ['FarmFacet', farmFacet],
      ['FieldFacet', fieldFacet],
      ['FundraiserFacet', fundraiserFacet],
      ['MarketplaceFacet', marketplaceFacet],
      ['OwnershipFacet', ownershipFacet],
      ['PauseFacet', pauseFacet],
      ['SeasonFacet', seasonFacet],
      ['SiloFacet', siloFacet],
      ['FertilizerFacet', fertilizerFacet],
      ['TokenFacet', tokenFacet],
      ['UnripeFacet', unripeFacet],
      ['WhitelistFacet', whitelistFacet]
    ],
    owner: account,
    args: args,
    verbose: verbose
  });

  tx = beanstalkDiamond.deployTransaction
  receipt = await tx.wait()
  if (verbose) console.log('Beanstalk diamond deploy gas used: ' + strDisplay(receipt.gasUsed))
  if (verbose) console.log('Beanstalk diamond cut gas used: ' + strDisplay(diamondCut.gasUsed))
  totalGasUsed = totalGasUsed.add(receipt.gasUsed).add(diamondCut.gasUsed)

  if (verbose) {
    console.log("--");
    console.log('Beanstalk diamond address:' + beanstalkDiamond.address)
    console.log("--");
  }

  const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', beanstalkDiamond.address)

  if (verbose) console.log('Total gas used: ' + strDisplay(totalGasUsed))
  return {
    account: account,
    beanstalkDiamond: beanstalkDiamond,
    diamondLoupeFacet: diamondLoupeFacet,
    bdvFacet,
    convertFacet,
    farmFacet,
    fieldFacet,
    fundraiserFacet,
    marketplaceFacet,
    ownershipFacet,
    pauseFacet,
    seasonFacet,
    siloFacet,
    fertilizerFacet,
    tokenFacet,
    unripeFacet
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
exports.deploy = main
