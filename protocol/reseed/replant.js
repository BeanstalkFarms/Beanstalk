const { replant3 } = require('./replant3.js')
const { replant4 } = require('./replant4.js')
const { replant5 } = require('./replant5.js')
const { replant6 } = require('./replant6.js')
const { replant7 } = require('./replant7.js')
const { replant8 } = require('./replant8.js')
const { replant9 } = require('./replant9.js')
const { replant10 } = require('./replant10.js')
const { replantMock } = require('./replantMock.js')
const fs = require('fs')

async function printBeanstalk() {
  console.log('\n')
  console.log('')
  const text = fs.readFileSync('./replant/data/replant.txt');
  console.log(text.toString())
  console.log('')
}

let replants
async function replant(account, deployAccount=undefined, mock=true, log=false, start=3, end=0) {
  if (mock && start == 3) {
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [ ~~(Date.now() / 1000)],
    });
  }
  replants = [
    '0',
    '0',
    '0',
    replant3,
    replant4,
    replant5,
    replant6,
    replant7,
    (account) => replant8(account, deployAccount),
    replant9,
    (account) => replant10(account, mock, log)
  ]
  if (mock) replants.push(replantMock)

  console.clear()
  await printBeanstalk()
  end = end || replants.length
  for (let i = start; i < end; i++) {
    printStage(i, end, mock, log)
    await replants[i](account)
  }
  console.log("Replant successful.")
}

function getProcessString(processed, total) {
  const max = 20
  const eq = max * processed / total
  const sp = max-eq
  return `[${'='.repeat(eq)}${' '.repeat(sp)}]`
}

async function printStage(i, end, mock, log) {
  if (!log) {
    console.clear()
    printBeanstalk()
  } else {
    console.log('==============================================')
  }
  console.log("Replanting Beanstalk:")
  console.log(`Mocks Enabled: ${mock}`)
  console.log(`Stage ${i}/${end-1}: ${getProcessString(i, end-1)}`)
}

exports.replant = replant