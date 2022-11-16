const { getBeanstalk, impersonateBeanstalkOwner, mintEth } = require("../../utils")
const fs = require('fs');
const { upgradeWithNewFacets } = require("../diamond");
const { BEANSTALK } = require("../../test/utils/constants");

const EVENTS_JSON = './scripts/bip24-event-emission/events.json'

async function emitEvents(mock = true, account = undefined) {
    const siloEvents = JSON.parse(await fs.readFileSync(EVENTS_JSON));

    if (account == undefined) {
        account = await impersonateBeanstalkOwner()
        await mintEth(account.address)
    }

    beanstalk = await getBeanstalk()
    await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [],
        initFacetName: 'InitSiloEvents',
        initArgs: [siloEvents],
        selectorsToRemove: ['0x0e2808eb', '0x0d010ea9', '0x261bcf0d'],
        bip: false,
        object: !mock,
        verbose: true,
        account: account
      });
}

exports.emitEvents = emitEvents