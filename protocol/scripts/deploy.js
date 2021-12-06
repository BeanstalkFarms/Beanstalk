const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

const diamond = require('./diamond.js')
function addCommas (nStr) {
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

function strDisplay (str) {
  return addCommas(str.toString())
}

async function main (scriptName, verbose=true, mock=false) {
  if (verbose) {
    console.log('SCRIPT NAME: ', scriptName)
    console.log('MOCKS ENABLED: ', mock)
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
  

  async function deployFacets (verbose,
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
        let facetLibrary = Object.keys(libraries).reduce((acc,val) => {
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
    seasonFacet,
    oracleFacet,
    fieldFacet,
    siloFacet,
    governanceFacet,
    claimFacet,
    fundraiserFacet
  ] = mock ? await deployFacets(
      verbose,
      ['MockSeasonFacet',
      'MockOracleFacet',
      'MockFieldFacet',
      'MockSiloFacet',
      'MockGovernanceFacet',
      'MockClaimFacet',
      'MockFundraiserFacet'],
      ["LibClaim"],
      {
        "MockSiloFacet": ["LibClaim"],
        "MockFieldFacet": ["LibClaim"],
        "MockClaimFacet": ["LibClaim"]
      },
    ) : await deployFacets(
      verbose,
      ['SeasonFacet',
      'OracleFacet',
      'FieldFacet',
      'SiloFacet',
      'GovernanceFacet',
      'ClaimFacet',
      'FundraiserFacet']
      ["LibClaim"],
      {
        "SiloFacet": ["LibClaim"],
        "FieldFacet": ["LibClaim"],
        "ClaimFacet": ["LibClaim"]
      },
    )
  const initDiamondArg = mock ? 'contracts/mocks/MockInitDiamond.sol:MockInitDiamond' : 'contracts/farm/InitDiamond.sol:InitDiamond'
  // eslint-disable-next-line no-unused-vars

  let args = []
  if (mock) {
    const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
    mockRouter = await MockUniswapV2Router.deploy();
    args.push(mockRouter.address)
  }

  const [beanstalkDiamond, diamondCut] = await diamond.deploy({
    diamondName: 'BeanstalkDiamond',
    initDiamond: initDiamondArg,
    facets: [
      ['SeasonFacet', seasonFacet],
      ['OracleFacet', oracleFacet],
      ['FieldFacet', fieldFacet],
      ['SiloFacet', siloFacet],
      ['GovernanceFacet', governanceFacet],
      ['ClaimFacet', claimFacet],
      ['FundraiserFacet', fundraiserFacet]
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


  const season = await ethers.getContractAt('SeasonFacet', beanstalkDiamond.address);
  const bean = await season.bean();
  const pair = await season.pair();
  const pegPair = await season.pegPair();
  const silo = await ethers.getContractAt('SiloFacet', beanstalkDiamond.address);
  const weth = await silo.weth();

  if (verbose) {
    console.log("--");
    console.log('Beanstalk diamond address:' + beanstalkDiamond.address)
    console.log('Bean address:' + bean)
    console.log('Uniswap Pair address:' + pair)
    console.log("--");
  }

  const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', beanstalkDiamond.address)


  if (verbose) console.log('Total gas used: ' + strDisplay(totalGasUsed))
  return {
    account: account,
    beanstalkDiamond: beanstalkDiamond,
    diamondLoupeFacet: diamondLoupeFacet,
    seasonFacet: seasonFacet,
    oracleFacet: oracleFacet,
    fieldFacet: fieldFacet,
    siloFacet: siloFacet,
    governanceFacet: governanceFacet,
    claimFacet: claimFacet,
    fundraiserFacet, fundraiserFacet,
    pair: pair,
    pegPair: pegPair,
    weth: weth,
    bean: bean,
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
