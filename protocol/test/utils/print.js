async function printSopSeasons(season) {
  const s = await this.season.season()
  for (let i = 0; i < s; i++) {
    const sop = await season.seasonOfPlenty(i);
    console.log(`Season: ${i}, Sop: ${sop}`);
  }
  console.log("====================================")
}

async function print(f){
  console.log((await f).toString());
}

async function printS(s,f){
  console.log(s + ": " + (await f).toString());
}

async function printSops(silo) {
  const sops = await silo.seasonsOfPlenty();
  console.log('---------------------------------------------')
  console.log("Season of Plenty:")
  console.log(`Weth: ${sops.weth}`);
  console.log(`Base: ${sops.base}`);
  console.log(`Season: ${sops.last}`);
  console.log('---------------------------------------------')
}

async function printSeasonIncrease(silo) {
  console.log('---------------------------------------------')
  console.log('Supply Increases:')
  console.log(`Total Beans: ${await silo.totalFarmableBeans()}`)
  console.log(`Total Stalk: ${await silo.totalFarmableStalk()}`)
  console.log('---------------------------------------------')
}

async function printRain(season) {
  const rain = await season.rain();
  console.log('---------------------------------------------')
  console.log('Rain:')
  console.log(`Raining: ${rain.raining}`)
  console.log(`Start: ${rain.start}`)
  console.log(`Pods: ${rain.pods}`)
  console.log(`Stalk: ${rain.roots}`)
  console.log('---------------------------------------------')
}

async function printWeather(season) {
  const weather = await season.weather();
  console.log('---------------------------------------------')
  console.log('Weather:')
  console.log(`startSoil ${weather.startSoil}`)
  console.log(`lastDSoil ${weather.lastDSoil}`)
  console.log(`lastSoilPercent ${weather.lastSoilPercent}`)
  console.log(`lastSowTime ${weather.lastSowTime}`)
  console.log(`thisSowTime ${weather.thisSowTime}`)
  console.log(`yield ${weather.t}`)
  console.log(`didSowBelowMin ${weather.didSowBelowMin}`)
  console.log(`didSowFaster ${weather.didSowFaster}`)
  console.log('---------------------------------------------')
}


async function printAccount(account, silo) {
  console.log('---------------------------------------------')
  console.log(`Account: ${account}`)
  console.log(`Stalk: ${await silo.balanceOfStalk(account)}`)
  console.log(`Seeds: ${await silo.balanceOfSeeds(account)}`)
  console.log(`Plenty: ${await silo.balanceOfPlentyBase(account)}`)
  console.log(`Roots: ${await silo.balanceOfRoots(account)}`)
  console.log(`Last Update: ${await silo.lastUpdate(account)}`)
  console.log(`Stalk: ${await silo.lockedUntil(account)}`)
  console.log('---------------------------------------------')
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

async function printCrate(silo, address, index) {
  const crate = await silo.beanCrate(address,index);
  console.log("Printing Bean Crate: Supply: " + crate[0] + ", Sesson: " + crate[1]);
}

async function printLPCrate(silo, address, index) {
  const crate = await silo.lpCrate(address,index);
  console.log("Printing LP Crate: Supply: " + crate[0] + ", Sesson: " + crate[1]);
}

exports.print = print
exports.printS = printS
exports.printSops = printSops
exports.printSopSeasons = printSopSeasons
exports.printSeasonIncrease = printSeasonIncrease
exports.printSetOfCrates = printSetOfCrates
exports.printCrates = printCrates
exports.printCrate = printCrate
exports.printTestCrates = printTestCrates
exports.printRain = printRain
exports.printWeather = printWeather
exports.printAccount = printAccount
