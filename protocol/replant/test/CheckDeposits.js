const fs = require('fs');
const { SPOILED_BEAN, BEANSTALK, UNRIPE_BEAN, UNRIPE_LP } = require('../../test/utils/constants.js');

const { wrapWithRetryHandling } = require('../utils/retry.js');

const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"
const EARNED_DEPOSITS = "./replant/data/r7-earnedBeans.json"

async function checkDeposits() {
  const accounts = await ethers.getSigners()
  stackedAccount = accounts[0]
  const silo = await ethers.getContractAt('SiloFacet', BEANSTALK)
  
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  const earnedBeans = JSON.parse(await fs.readFileSync(EARNED_DEPOSITS))
  const lpDeposits = JSON.parse(await fs.readFileSync(LP_DEPOSITS));

  let deposits = beanDeposits.concat(earnedBeans.map(([acc, am]) => [acc, ['6074'], [am], am]))
  deposits = lpDeposits.concat(deposits.map(([account, seasons, amounts, totalAmount]) =>
    [account, SPOILED_BEAN, seasons, amounts, amounts, totalAmount]
  ))

  deposits = deposits.map(([account, token, seasons, amounts, bdvs, totalAmount]) =>
    seasons.map((k, i) => [account, getToken(token), k, amounts[i], bdvs[i]])
  ).flat()

  for (let i = 0; i < deposits.length; ++i) {
    let d = deposits[i]
  }
}

function getToken(token) {
  if (token == SPOILED_BEAN) return UNRIPE_BEAN
  else return UNRIPE_LP
}

exports.checkDeposits = checkDeposits