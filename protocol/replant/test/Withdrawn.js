const fs = require('fs')

const { wrapWithRetryHandling } = require('../utils/retry.js');

// Contracts
const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5"
const UNRIPE_BEAN = "0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449"
const UNRIPE_LP = "0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D"

// Files
const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"
const EARNED_DEPOSITS = "./replant/data/r7-earnedBeans.json"

let stackedAccount

async function withdrawAccount(silo, deposit, token, seasonId, amountId) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [deposit[0]],
  });
  await stackedAccount.sendTransaction({
    to: deposit[0],
    value: ethers.utils.parseEther("0.1")
  });
  const signer = await ethers.getSigner(deposit[0])
  // console.log(token)
  // console.log(deposit[seasonId])
  // console.log(deposit[amountId])
  // console.log(`${await silo.getDeposit(deposit[0], token, deposit[seasonId][0])}`)
  // console.log(`${await silo.getDeposit(deposit[0], token, deposit[seasonId][1])}`)
  await silo.connect(signer).withdrawDeposits(token, deposit[seasonId], deposit[amountId])
}

const ACCOUNT = '0x0086e622aC7afa3e5502dc895Fd0EAB8B3A78D97'

async function log(silo, ac) {
  console.log(`\n ${ac}`)
  console.log(`Stalk: ${await silo.balanceOfStalk(ac)}`)
  console.log(`Seeds: ${await silo.balanceOfSeeds(ac)}`)
  console.log(`Roots: ${await silo.balanceOfRoots(ac)}`)
}

async function withdraw() {
  const accounts = await ethers.getSigners()
  stackedAccount = accounts[0]
  const silo = await ethers.getContractAt('SiloFacet', BEANSTALK)
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  // console.log(`Stalk: ${await silo.balanceOfStalk(ACCOUNT)}`)
  // console.log(`Total Stalk: ${await silo.totalStalk()}`)
  // console.log(`Seeds: ${await silo.balanceOfSeeds(ACCOUNT)}`)
  // console.log(`Total Seeds: ${await silo.totalSeeds()}`)
  // console.log(`Roots: ${await silo.balanceOfRoots(ACCOUNT)}`)
  // console.log(`Earned Beans: ${await silo.getDeposit(ACCOUNT, '0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449', 6074)}`)
  // console.log("Withdrawing Bean Deposits:")

  let asdf = []
  // for (let i = 0; i < 10; i ++) {
  //   asdf.push(beanDeposits[i+250][0])
  // }

  let withdrawRetry = wrapWithRetryHandling((beanDeposit) => {
    return withdrawAccount(silo, beanDeposit, UNRIPE_BEAN, 1, 2)
  })

  for (let i = 0; i < beanDeposits.length; i++) {
    // if (beanDeposits[i][0] == ACCOUNT) {
    // if (asdf.includes(beanDeposits[i][0])) {
    if (true) {
      await withdrawRetry(beanDeposits[i])
      process.stdout.write("\r\x1b[K")
      process.stdout.write(`${i+1} accounts of ${beanDeposits.length}: ${beanDeposits[i][0]}`)
    }
  }
  console.log("\nWithdrawing LP Deposits:")
  const lpDeposits = JSON.parse(await fs.readFileSync(LP_DEPOSITS));

  withdrawRetry = wrapWithRetryHandling((lpDeposit) => {
    return withdrawAccount(silo, lpDeposit, UNRIPE_LP, 2, 3)
  })

  for (let i = 0; i < lpDeposits.length; i++) {
    // if (lpDeposits[i][0] == ACCOUNT) {
    // if (asdf.includes(lpDeposits[i][0])) {
    if (true) {
      getAmount(lpDeposits[i])
      await withdrawRetry(lpDeposits[i])
      process.stdout.write("\r\x1b[K")
      process.stdout.write(`${i + 1} accounts of ${lpDeposits.length}: ${lpDeposits[i][0]}`)
    }
  }
  const earnedDeposits = JSON.parse(await fs.readFileSync(EARNED_DEPOSITS));

  withdrawRetry = wrapWithRetryHandling((earnedDeposit) => {
    return withdrawAccount(silo, [earnedDeposit[0], ['6074'], [earnedDeposit[1]]], UNRIPE_BEAN, 1, 2)
  })
  console.log("\nWithdrawing Earned Deposits:")
  for (let i = 0; i < earnedDeposits.length; i++) {
    // if (earnedDeposits[i][0] == ACCOUNT) {
    // if (asdf.includes(earnedDeposits[i][0])) {
    if (true) {
      await withdrawRetry(earnedDeposits[i])
      process.stdout.write("\r\x1b[K")
      process.stdout.write(`${i + 1} accounts of ${earnedDeposits.length}: ${earnedDeposits[i][0]}`)
    }
  }

  // for (let i = 0; i < beanDeposits.length; i++) {
  //   // if (beanDeposits[i][0] == ACCOUNT) {
  //   if (asdf.includes(beanDeposits[i][0])) {
  //   // if (true) {
  //     await log(silo, beanDeposits[i][0])
  //   }
  // }
  // console.log("\n")
  // console.log(`Stalk: ${await silo.balanceOfStalk(ACCOUNT)}`)
  // console.log(`Seeds: ${await silo.balanceOfSeeds(ACCOUNT)}`)
  // console.log(`Roots: ${await silo.balanceOfRoots(ACCOUNT)}`)
}

exports.withdraw = withdraw


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

const modifiers = {
  '0x87898263b6c5babe34b4ec53f22d98430b91e371': '119894802186829',
  '0x3a70DfA7d2262988064A2D051dd47521E43c9BdD': '992035',
  '0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D': '983108'
}

function getAmount(d) {
  d[3] = d[3].map((l) => ethers.BigNumber.from(l).mul(
    ethers.BigNumber.from((modifiers[d[1]]))).div(ethers.utils.parseEther('1')).toString()
  )
  return d
}