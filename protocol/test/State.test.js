// const { expect } = require('chai')
// const { deploy } = require('../scripts/deploy.js')
// const { parseJson } = require('./utils/helpers.js')
// const { BEAN } = require('./utils/constants')

// // Set the test data
// const [columns, tests] = parseJson('./coverage_data/weather.json')
// var numberTests = tests.length
// var startTest = 0

// describe('State', function () {

//   before(async function () {
//     [owner,user,user2] = await ethers.getSigners()
//     userAddress = user.address
//     user2Address = user2.address
//     const contracts = await deploy("Test", false, true)
//     await upgradeWithNewFacets({
//       diamondAddress: BEANSTALK,
//       facetNames: ['StateFacet'],
//       initFacetName: undefined,
//       bip: false,
//       verbose: true,
//       account: owner
//     });
//     this.state = await ethers.getContractAt('StateFacet', BEAN)

//   });

//   it('gets the deposits', async function () {
//     await this.state.getDeposits(owner.address, BEAN, 0, 1000)
//   })
// })
