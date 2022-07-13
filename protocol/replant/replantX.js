const fs = require('fs')
const { wrapWithRetryHandling } = require('./utils/retry.js');
const { BEANSTALK } = require('../test/utils/constants.js');

// Files
const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"
const SILO_ACCOUNTS = "./replant/data/r7-siloAccounts.json"

async function replant7(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant7:\n')

  // const siloAccounts = await countStalkSeeds(JSON.parse(await fs.readFileSync(EARNED_BEANS)));
  const siloAccounts = JSON.parse(await fs.readFileSync(SILO_ACCOUNTS))
  console.log(siloAccounts)
  const stalk = siloAccounts.reduce((acc, s) => acc.add(toBN(s[2])), toBN('0'))
  const seeds = siloAccounts.reduce((acc, s) => acc.add(toBN(s[3])), toBN('0'))
  await replantX(account, siloAccounts, 'Replant7', chunkSize = 50, true, [stalk, seeds])
  console.log('-----------------------------------')
}

async function replant6(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant6:\n')
  
  const lpDeposits = JSON.parse(await fs.readFileSync(LP_DEPOSITS));
  await replantX(account, lpDeposits, 'Replant6', chunkSize = 60, init2 = true) // 110
  console.log('-----------------------------------')
}

async function replant5(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant5:\n')
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  await replantX(account, beanDeposits, 'Replant5', chunkSize = 50) // 180
  console.log('-----------------------------------')
}

async function replantX(
  account,
  _deposits,
  name,
  chunkSize = 180,
  init2 = false,
  initData = []
) {

  const deposits = chunkArray(_deposits, chunkSize)

  const ReplantX = await ethers.getContractFactory(name, account)
  const replantX = await ReplantX.deploy()
  await replantX.deployed();

  const diamondCut = await ethers.getContractAt('DiamondCutFacet', BEANSTALK)


  if (init2) {
    functionCall = replantX.interface.encodeFunctionData('init2', initData)
    const receipt = await diamondCut.connect(account).diamondCut(
      [],
      replantX.address,
      functionCall
    )
    const gasUsed = (await receipt.wait()).gasUsed
    console.log(`init2 gas used: ${strDisplay(gasUsed)}`)
  }

  let totalGasUsed = ethers.BigNumber.from('0')
  let start = 0

  const diamondCutRetry = wrapWithRetryHandling((functionCall) => {
    return diamondCut.connect(account).diamondCut(
      [],
      replantX.address,
      functionCall
    )
  })
  for (let i = start; i < deposits.length; i++) {
    functionCall = replantX.interface.encodeFunctionData('init', [deposits[i]])
    const receipt = await diamondCutRetry(functionCall)
    const gasUsed = (await receipt.wait()).gasUsed
    totalGasUsed = totalGasUsed.add(gasUsed)
    console.log(`${i+1}/${deposits.length}: Wallets Processed ${deposits[i].length} gas used: ${strDisplay(gasUsed)}`)
  }

  console.log(`Total Wallets Processed ${_deposits.length} gas used: ${strDisplay(totalGasUsed)}`)
}

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

const chunkArray = (arr, size) =>
arr.length > size
  ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
  : [arr];


exports.replant5 = replant5
exports.replant6 = replant6
exports.replant7 = replant7