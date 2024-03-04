const { expect } = require('chai');
const { deploy } = require('../scripts/newDeploy.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

describe('newDeploy', function () {
    before(async function () {
        const contracts = await deploy(
            verbose=true,
            mock=true,
            reset=true
        );
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    describe('works', function () {
        it('properly updates the user balances', async function () {
          console.log("works")
        });
    });
})