const { replant3 } = require('./replant3.js')
const { replant4 } = require('./replant4.js')
const { replant5 } = require('./replant5.js')
const { replant6 } = require('./replant6.js')
const { replant7 } = require('./replant7.js')
const { replant8 } = require('./replant8.js')
const { replant9 } = require('./replant9.js')
const { replant10 } = require('./replant10.js')

function printBeanstalk() {

  console.log('\n')
  console.log("------------------------------------------------------------------")
  console.log(",--.                                  ,--.          ,--.,--.     ")
  console.log("|  |-.  ,---.  ,--,--.,--,--,  ,---.,-'  '-. ,--,--.|  ||  |,-.  ")
  console.log("| .-. '| .-. :' ,-.  ||      \\(  .-''-.  .-'' ,-.  ||  ||     /  ")
  console.log("| `-' |\\   --.\\ '-'  ||  ||  |.-'  `) |  |  \\ '-'  ||  ||  \\  \\  ")
  console.log(" `---'  `----' `--`--'`--''--'`----'  `--'   `--`--'`--'`--'`--' ")
  console.log("------------------------------------------------------------------")
}

const replants = [
  '0',
  '0',
  '0',
  replant3,
  replant4,
  replant5,
  replant6,
  replant7,
  replant8,
  replant9,
  replant10
]

async function replant(account) {
  console.clear()
  printBeanstalk()
  for (let i = 3; i < replants.length; i++) {
    printStage(i, replants.length)
    await replants[i](account)
  }
  printStage(replants.length, replants.length)
  console.log("Replant successful.")
}

function getProcessString(processed, total) {
  const max = 20
  const eq = max * processed / total
  const sp = max-eq
  return `[${'='.repeat(eq)}${' '.repeat(sp)}]`
}

function printStage(i, j) {
  console.clear()
  printBeanstalk()
  console.log("Commencing replant sequence:")
  console.log(`Stage ${i}/${replants.length}: ${getProcessString(i, replants.length)}`)
}

exports.replant = replant