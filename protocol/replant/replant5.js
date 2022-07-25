const fs = require('fs')
const { replantX } = require('./replantX.js')

// Files
const BEAN_DEPOSITS = "./replant/data/r5-beanDeposits.json"

async function replant5(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant5: Migrate Bean Deposits\n')
  const beanDeposits = JSON.parse(await fs.readFileSync(BEAN_DEPOSITS));
  await replantX(account, beanDeposits, 'Replant5', chunkSize = 50) // 180
  console.log('-----------------------------------')
}
exports.replant5 = replant5