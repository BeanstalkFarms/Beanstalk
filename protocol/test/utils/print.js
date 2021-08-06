async function print(f){
  console.log((await f).toString());
}

async function printS(s,f){
  console.log(s + ": " + (await f).toString());
}

async function printSops(silo, season) {
  const sops = await silo.seasonsOfPlenty();
  console.log("====================================")
  console.log("Season of Plenty:")
  console.log(`Weth: ${sops.weth}`);
  console.log(`Base: ${sops.base}`);
  let sop = await season.seasonOfPlenty(sops.last);
  let rbs = await season.resetBase(sops.last);
  if (sops.last > 0) printSop(sops.last, sop, rbs)
  while (sop.next > 0) {
    const s = sop.next
    sop = await season.seasonOfPlenty(sop.next);
    rbs = await season.resetBase(sop.next);
    printSop(s, sop, rbs)
  }
  console.log("====================================")
}
function printSop(season, sop, rbs) {
  console.log(`\nSop at Season: ${season}`)
  console.log(`Base: ${sop.base}`)
  console.log(`Increase Base: ${sop.increaseBase}`)
  console.log(`Reset Base: ${rbs.sopMultiple}`)
  console.log(`Next: ${sop.next}`)
}

async function printSeasonIncrease(season, silo) {
  const _s = await season.season();
  const seasonIncrease = await season.seasonIncrease(_s);
  const supplyIncreases = await silo.supplyIncreases();
  console.log("-----------------------------------------------")
  console.log(`Season: ${_s}`)
  console.log(`Increase per Base: ${seasonIncrease.increaseBase}`)
  console.log(`Stalk per Base: ${seasonIncrease.stalkBase}`)
  console.log(`Total Increase Base: ${supplyIncreases.increaseBase}`)
  console.log(`Total Increase: ${supplyIncreases.increase}`)
  console.log(`Total Stalk Base: ${supplyIncreases.stalkBase}`)
  console.log(`Total Stalk: ${supplyIncreases.stalk}`)
  console.log("-----------------------------------------------")
}

function printSetOfCrates(cratesName, seasons, crates, seedCrates) {
  console.log(`${cratesName} Crates:`)
  if (seasons.length > 0) {
    seasons.forEach((s, i) => {
      if (seedCrates !== undefined) console.log(`Season: ${s}, LP: ${crates[i]}, Seeds: ${seedCrates[i]}`)
      else console.log(`Season: ${s}, Beans: ${crates[i]}`)
    });
  } else {
    console.log(`User has no ${cratesName} crates`)
  }

}

async function printCrates(silo, account, accountName = "user") {
  console.log('-------------------------------------')
  console.log(`PRINTING CRATES FOR: ${accountName}`)
  const beanCrates = await silo.beanDeposits(account);
  printSetOfCrates("Bean Deposit", beanCrates.seasons, beanCrates.crates)
  console.log()
  const lpCrates = await silo.lpDeposits(account);
  printSetOfCrates("LP Deposit", lpCrates.seasons, lpCrates.crates, lpCrates.seedCrates)
  console.log()
  const beanWithdrawals = await silo.beanWithdrawals(account);
  printSetOfCrates("Bean Withdrawal", beanWithdrawals.seasons, beanWithdrawals.crates)
  console.log()
  const lpWithdrawals = await silo.lpWithdrawals(account);
  printSetOfCrates("LP Withdrawal", lpWithdrawals.seasons, lpWithdrawals.crates)
  console.log('-------------------------------------')
}

function printTestCrates(userName, data) {
    console.log(userName," beanDeposits",data.beanDeposits[userName])
    console.log(userName," LPDeposits",data.LPDeposits[userName])
    console.log(userName," beanTransits",data.beanTransitDeposits[userName])
    console.log(userName," LPTransits",data.LPTransitDeposits[userName])
}

exports.print = print
exports.printS = printS
exports.printSops = printSops
exports.printSop = printSop
exports.printSeasonIncrease = printSeasonIncrease
exports.printSetOfCrates = printSetOfCrates
exports.printCrates = printCrates
exports.printTestCrates = printTestCrates
