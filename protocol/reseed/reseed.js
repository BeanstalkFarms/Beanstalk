const { reseed1 } = require('./reseed1.js')
const { reseed2 } = require('./reseed2.js')
const { reseed3 } = require('./reseed3.js')
const { reseed4 } = require('./reseed4.js')
const { reseed5 } = require('./reseed5.js')
const { reseed6 } = require('./reseed6.js')
const { reseed7 } = require('./reseed7.js')


const fs = require('fs')


async function printBeanstalk() {
  console.log('\n')
  console.log('')
  const text = fs.readFileSync('./reseed/data/reseed.txt');
  console.log(text.toString())
  console.log('')
}

let reseeds
async function reseed(account, deployAccount=undefined, mock=true, log=false, start=1, end=2) {
  if (mock && start == 1) {
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [ ~~(Date.now() / 1000)],
    });
  }
  reseeds = [
    0,
    reseed1,
    reseed2
  ]
  // if (mock) reseeds.push(replantMock)

  console.clear()
  await printBeanstalk()
  for (let i = start; i < end; i++) {
    printStage(i, end, mock, log)
    await reseeds[i](account)
  }
  console.log("Reseed successful.")
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
  console.log("Reseeding Beanstalk:")
  console.log(`Mocks Enabled: ${mock}`)
  console.log(`Stage ${i}/${end-1}: ${getProcessString(i, end-1)}`)
}

exports.reseed = reseed