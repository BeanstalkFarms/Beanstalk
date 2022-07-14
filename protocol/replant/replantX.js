const fs = require('fs')
const { wrapWithRetryHandling } = require('./utils/retry.js');
const { BEANSTALK, BCM, USDC, SPOILED_BEAN } = require('../test/utils/constants.js');

// Files
const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"
const SILO_ACCOUNTS = "./replant/data/r7-siloAccounts.json"
const EARNED_BEANS = "./replant/data/r7-earnedBeans.json"

const PRUNE = '1'
// const PRUNE = '1'
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

async function replant7(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant7:\n')

  const siloAccounts = await countStalkSeeds();
  // const siloAccounts = JSON.parse(await fs.readFileSync(SILO_ACCOUNTS))
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
    process.stdout.write("\r\x1b[K")
    process.stdout.write(`${chunkSize*(i+1)}/${_deposits.length}: ${getProcessString(i, deposits.length)} gas used: ${strDisplay(totalGasUsed)}`)
  }

  process.stdout.write("\r\x1b[K")
  process.stdout.write(`${_deposits.length}/${_deposits.length}: ${getProcessString(1,1)} gas used: ${strDisplay(totalGasUsed)}`)
}

// let account_;

async function countStalkSeeds() {
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  const earnedBeans = JSON.parse(await fs.readFileSync(EARNED_BEANS))
  const lpDeposits = JSON.parse(await fs.readFileSync(LP_DEPOSITS));

  let deposits = beanDeposits.concat(earnedBeans.map(([acc, am]) => [acc, ['6074'], [am], am]))
  deposits = lpDeposits.concat(deposits.map(([account, seasons, amounts, totalAmount]) =>
    [account, SPOILED_BEAN, seasons, amounts, amounts, totalAmount]
  ))

  const replant7 = Object.values(deposits.reduce((acc, [account, token, seasons, amounts, bdvs, totalAmount]) => {
    if (!acc[account]) acc[account] = [account, getEarndBeans(earnedBeans, account), toBN('0'), toBN('0')]
    account_ = account
    const [st, se] = getStalkSeedsRow(token, seasons, bdvs)
    // if (account == "0x01C7145c01d06a026D3dDA4700b727fE62677628") console.log(`${token}: ${bdvs}, ${st}, ${se}`)
    acc[account][2] = acc[account][2].add(st)
    acc[account][3] = acc[account][3].add(se)
    return acc
  }, {})).map((d) => [d[0], d[1], d[2].toString(), d[3].toString()]).sort((a,b) => a[0] > b[0])

  await fs.writeFileSync(`./replant/data/replant7.json`, JSON.stringify(replant7, null, 4));
  return replant7
}

function toBN(a) {
  return ethers.BigNumber.from(a)
}

const zip = (a, b) => a.map((k, i) => [k, b[i]]);

function getEarndBeans(earnedBeans, account) {
  const asdf = earnedBeans.filter((eb) => eb[0] === account)
  return asdf.length == 0 ? '0' : asdf[0][1]
}

function getStalkSeedsRow(token, seasons, bdvs) {
  return zip(seasons, bdvs).reduce(([stalk, seeds], [s,b]) => {
    // if (account_ == "0x01C7145c01d06a026D3dDA4700b727fE62677628") {
    //   console.log(`${s} ${b}`)
    // }
    const [st, se] = getStalkSeeds(token, s, b)
    // if (account_ == "0x01C7145c01d06a026D3dDA4700b727fE62677628") {
    //   console.log(`${st} ${se}`)
    // }
    return [
      stalk.add(st),
      seeds.add(se)
    ]
  }, [toBN('0'), toBN('0')])
}

function getProcessString(processed, total) {
  const max = 20
  const eq = max * processed / total
  const sp = max-eq
  return `[${'='.repeat(eq)}${' '.repeat(sp)}]`
} 

function getStalkSeeds(token, season, bdv) {
  const seedsPerBdv = toBN(token === SPOILED_BEAN ? '2': '4')
  const stalkPerBdv = toBN('10000')
  // console.log('------')
  // console.log(bdv)
  // console.log(toBN(percent)) 
  // if (account_ == "0x01C7145c01d06a026D3dDA4700b727fE62677628") {
  //   console.log(`${bdv} ${seedsPerBdv} ${stalkPerBdv}`)
  // }
  bdv = toBN(bdv).mul(ethers.utils.parseEther(PRUNE)).div(ethers.utils.parseEther('1'))
  // if (account_ == "0x01C7145c01d06a026D3dDA4700b727fE62677628") {
  //   console.log(`${bdv}`)
  // }
  return [
    bdv.mul(stalkPerBdv.add(seedsPerBdv.mul(toBN(REPLANT_SEASON).sub(toBN(season))))),
    bdv.mul(seedsPerBdv)
  ]
}

exports.replant5 = replant5
exports.replant6 = replant6
exports.replant7 = replant7
exports.countStalkSeeds = countStalkSeeds