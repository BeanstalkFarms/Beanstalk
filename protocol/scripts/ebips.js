const fs = require('fs')
const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../utils")

async function ebip5(mock = true, account = undefined) {
    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    beanstalk = await getBeanstalk()
    const Ebip5 = await ethers.getContractFactory("InitEBip5", account)
    const ebip5 = await Ebip5.deploy()
    const dc = {
        diamondCut: [
                        [
                            '0x0c9F436FBEf08914c1C68fe04bD573de6e327776',
                            '0',
                            ['0xdf18a3ee', '0x845a022b', '0x82c65124']
                        ]
                    ],
        initFacetAddress: ebip5.address,
        functionCall: ebip5.interface.encodeFunctionData('init', [])
    }
    if (mock) {
        const receipt = await beanstalk.connect(account).diamondCut(Object.values(dc))
    } else {
        const encodedDiamondCut = await beanstalk.interface.encodeFunctionData('diamondCut', Object.values(dc))
        console.log(JSON.stringify(dc, null, 4))
        console.log("Encoded: -------------------------------------------------------------")
        console.log(encodedDiamondCut)
        const dcName = `diamondCut-${'InitEBip5'}-${Math.floor(Date.now() / 1000)}-facets.json`
        await fs.writeFileSync(`./diamondCuts/${dcName}`, JSON.stringify({diamondCut: dc, encoded: encodedDiamondCut }, null, 4));
        return dc
    }
}

exports.ebip5 = ebip5