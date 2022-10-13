const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5"
const fs = require('fs');
const { getBeanstalk } = require('../utils');
require('dotenv').config();

async function reset(bn) {
  await network.provider.request({
    method: "hardhat_reset",
    params: [{
        forking: {
          jsonRpcUrl: process.env.FORKING_RPC,
          blockNumber: bn,
        },
      },],
  });
}
async function checkEbip0() {
    const convertData = JSON.parse(fs.readFileSync('./scripts/data/withdrawers.json'))
    const beanstalk = await getBeanstalk()

    const errors = []
    process.stdout.write(`${(0)}/${convertData.length}`)

    console.log(1)
  
    for (let i = 0; i < 1195; i++) {
        const c = convertData[i]
        const ebBefore = await beanstalk.balanceOfEarnedBeans(c.account, { blockTag: c.blockNumber-1 })
        let diff = ebBefore
        if (ebBefore.gt('0')) {
            const ebAfter = await beanstalk.balanceOfEarnedBeans(c.account, { blockTag: c.blockNumber+1})
            diff = ebBefore.sub(ebAfter)
            if (diff.gt('0')) {
                errors.push([c.account, `${diff}`])
            }
        }
        process.stdout.write("\r\x1b[K")
        process.stdout.write(`${(i+1)}/${convertData.length}: ${c.account}, ${diff}, found: ${errors.length}`)
    }
    console.log('\n')
    console.log(errors)
    await fs.writeFileSync(`./scripts/data/effectAccounts2.csv`, errors.map(e => e.join(",").toString()).join("\n"));
}

exports.checkEbip0 = checkEbip0
