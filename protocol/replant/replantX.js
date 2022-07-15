const fs = require('fs')
const { wrapWithRetryHandling } = require('./utils/retry.js');
const { BEANSTALK } = require('../test/utils/constants.js');

// Files
const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"
const EARNED_BEANS = "./replant/data/r7-earnedBeans.json"

const REPLANT_SEASON = '6074'

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
    process.stdout.write("\r\x1b[K")
    process.stdout.write(`${chunkSize*(i+1)}/${_deposits.length}: ${getProcessString(i, deposits.length)} gas used: ${strDisplay(totalGasUsed)}`)
  }

  process.stdout.write("\r\x1b[K")
  process.stdout.write(`${_deposits.length}/${_deposits.length}: ${getProcessString(1,1)} gas used: ${strDisplay(totalGasUsed)}`)
}

function getProcessString(processed, total) {
  const max = 20
  const eq = max * processed / total
  const sp = max-eq
  return `[${'='.repeat(eq)}${' '.repeat(sp)}]`
} 

exports.getProcessString = getProcessString
exports.replantX = replantX