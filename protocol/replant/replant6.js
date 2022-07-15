const fs = require('fs')
const { replantX } = require('./replantX.js')

// Files
const LP_DEPOSITS = "./replant/data/r6-lpDeposits.json"

async function replant6(
  account
) {
  console.log('-----------------------------------')
  console.log('Replant6:\n')
  
  const lpDeposits = JSON.parse(await fs.readFileSync(LP_DEPOSITS));
  await replantX(account, lpDeposits, 'Replant6', chunkSize = 60, init2 = true) // 110
  console.log('-----------------------------------')
}
exports.replant6 = replant6