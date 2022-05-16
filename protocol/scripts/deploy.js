const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

const diamond = require('./diamond.js')
const { 
  impersonateBean, 
  impersonateCurve,
  impersonateCurveMetapool, 
  impersonateWeth, 
  impersonateUnripe, 
  impersonateBarnRaise 
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

async function main(scriptName, verbose = true, mock = false) {
  if (verbose) {
    console.log('SCRIPT NAME: ', scriptName)
    console.log('MOCKS ENABLED: ', mock)
  }

  if (mock) {
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
    fieldFacet,
    fundraiserFacet,
    marketplaceFacet,
    pauseFacet,
    seasonFacet,
    siloFacet,
    barnRaiseFacet,
    tokenFacet,
    unripeFacet,
    whitelistFacet
  ] = mock ? await deployFacets(
    verbose,
    [ 'BDVFacet',
      'CurveFacet',
      'MockConvertFacet',
      'MockFieldFacet',
      'MockFundraiserFacet',
      'MockMarketplaceFacet',
      'PauseFacet',
      'MockSeasonFacet',
      'MockSiloFacet',
      'MockBarnRaiseFacet',
      'TokenFacet',
      'MockUnripeFacet',
      'WhitelistFacet'],
  ) : await deployFacets(
    verbose,
    [ 'BDVFacet',
      'CurveFacet',
      'ConvertFacet',
      'FieldFacet',
      'FundraiserFacet',
      'MarketplaceFacet',
      'PauseFacet',
      'SeasonFacet',
      'SiloFacet',
      'BarnRaiseFacet',
      'TokenFacet',
      'UnripeFacet',
      'WhitelistFacet'],
  )
  const initDiamondArg = mock ? 'contracts/mocks/MockInitDiamond.sol:MockInitDiamond' : 'contracts/farm/InitDiamond.sol:InitDiamond'
  // eslint-disable-next-line no-unused-vars

  let args = []
  if (mock) {
    await impersonateCurve()
    await impersonateBean()
    await impersonateCurveMetapool()
    await impersonateWeth()
    await impersonateUnripe()
    await impersonateBarnRaise()
  }

  const [beanstalkDiamond, diamondCut] = await diamond.deploy({
    diamondName: 'BeanstalkDiamond',
    initDiamond: initDiamondArg,
    facets: [
      ['BDVFacet', bdvFacet],
      ['CurveFacet', curveFacet],
      ['ConvertFacet', convertFacet],
      ['FieldFacet', fieldFacet],
      ['FundraiserFacet', fundraiserFacet],
      ['MarketplaceFacet', marketplaceFacet],
      ['PauseFacet', pauseFacet],
      ['SeasonFacet', seasonFacet],
      ['SiloFacet', siloFacet],
      ['BarnRaiseFacet', barnRaiseFacet],
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
  if (verbose) console.log('BeanStalk diamond deploy gas used: ' + strDisplay(receipt.gasUsed))
  if (verbose) console.log('BeanStalk diamond cut gas used: ' + strDisplay(diamondCut.gasUsed))
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
    fieldFacet,
    fundraiserFacet,
    marketplaceFacet,
    pauseFacet,
    seasonFacet,
    siloFacet,
    barnRaiseFacet,
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
