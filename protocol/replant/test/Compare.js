const fs = require('fs')

const SILO_ACCOUNTS = "./replant/data/r7-siloAccounts.json"
const REPLANT7 = "./replant/data/replant7.json"

async function compare() {
  const earnedBeans = JSON.parse(await fs.readFileSync(SILO_ACCOUNTS))
  const lpDeposits = JSON.parse(await fs.readFileSync(REPLANT7));

  let asdf = 0;
  for (let i = 0; i < earnedBeans.length; i++) {
    const eb = earnedBeans[i]
    const lpD = lpDeposits.filter((lp) => lp[0] == eb[0])[0]
    if (
      eb[1] !== lpD[1] ||
      eb[2] !== lpD[2] ||
      eb[3] !== lpD[3]
    ) {
      console.log(eb[0])
      console.log((parseInt(eb[2]) - parseInt(lpD[2]))/eb[2])
      console.log((parseInt(eb[3]) - parseInt(lpD[3]))/eb[3])
      console.log('-------------')
      asdf++
    }
  }
  console.log(asdf)
}

(async () => {
  await compare()
})();