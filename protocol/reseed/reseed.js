const { reseed1 } = require("./reseed1.js");
const { reseedDeployL2Beanstalk } = require("./reseedDeployL2Beanstalk.js");
const { reseed3 } = require("./reseed3.js");
const { reseed4 } = require("./reseed4.js");
const { reseed5 } = require("./reseed5.js");
const { reseed6 } = require("./reseed6.js");
const { reseed7 } = require("./reseed7.js");
const { reseed8 } = require("./reseed8.js");
const { reseed9 } = require("./reseed9.js");

const fs = require("fs");

async function printBeanstalk() {
  console.log("\n");
  console.log("");
  const text = fs.readFileSync("./reseed/data/reseed.txt");
  console.log(text.toString());
  console.log("");
}

let reseeds;
async function reseed(account, mock = true, log = false, start = 0, end = 9) {
  reseeds = [
    reseed1, // pause l1 beanstalk
    reseedDeployL2Beanstalk, // deploy l2 beanstalk diamond
    reseed3, // reseedbean + deploy wells on l2
    reseed4, // reseed field
    reseed5, // reseed barn (fert)
    reseed6, // reseed silo
    reseed7, // reseed internal balances
    // reseed8, // reseed whitelist
    reseed9  // add selectors to l2
  ];
  let l2BeanstalkAddress;
  console.clear();
  await printBeanstalk();
  for (let i = start; i < reseeds.length; i++) {
    printStage(i, end, mock, log);
    console.log("L2 Beanstalk:", l2BeanstalkAddress);
    if (i == 0) {
      // migrate beanstalk L1 assets.
      await reseeds[0](account);
    } else if (i == 1 && mock == true) {
      // deploy L2 beanstalk with predetermined address.
      l2BeanstalkAddress = await reseedDeployL2Beanstalk(account, true, mock);
    } else {
      // initialize beanstalk state.
      await reseeds[i](account, l2BeanstalkAddress);
    }
  }
  console.log("Reseed successful.");
}

function getProcessString(processed, total) {
  const max = 20;
  const eq = (max * processed) / total;
  const sp = max - eq;
  return `[${"=".repeat(eq)}${" ".repeat(sp)}]`;
}

async function printStage(i, end, mock, log) {
  if (!log) {
    console.clear();
    printBeanstalk();
  } else {
    console.log("==============================================");
  }
  console.log("Reseeding Beanstalk:");
  console.log(`Mocks Enabled: ${mock}`);
  console.log(`Stage ${i}/${end - 1}: ${getProcessString(i, end - 1)}`);
}

exports.reseed = reseed;
