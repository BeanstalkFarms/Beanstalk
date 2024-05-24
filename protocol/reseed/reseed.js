const { reseed1 } = require("./reseed1.js");
const { reseedDeployL2Beanstalk } = require("./reseedDeployL2Beanstalk.js");
const { reseed3 } = require("./reseed3.js");

const fs = require("fs");

async function printBeanstalk() {
  console.log("\n");
  console.log("");
  const text = fs.readFileSync("./reseed/data/reseed.txt");
  console.log(text.toString());
  console.log("");
}

let reseeds;
async function reseed(
  account,
  deployAccount = undefined,
  mock = true,
  log = false,
  start = 0,
  end = 2
) {
  reseeds = [reseed1, reseedDeployL2Beanstalk, reseed3];
  let l2Beanstalk;
  console.clear();
  await printBeanstalk();
  for (let i = start; i < end; i++) {
    printStage(i, end, mock, log);
    if (i == 0) {
      // migrate beanstalk L1 assets.
    }
    if (i == 1 && mock == true) {
      // deploy L2 beanstalk.
      l2Beanstalk = await reseedDeployL2Beanstalk(account);
    } else {
      // initialize beanstalk state.
      await reseeds[i](account, l2Beanstalk);
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
