const fs = require('fs');
const { getBeanstalk } = require('./contracts');
const { mintEth } = require('./mint');
const { impersonateBeanstalkOwner } = require('./signer');

const BASE_STRING = './node_modules/@beanstalk/wells/out';

async function getWellContractFactory(name) {
    const contractJson = JSON.parse(await fs.readFileSync(`${BASE_STRING}/${name}.sol/${name}.json`))
    return await ethers.getContractFactory(
        contractJson.abi,
        contractJson.bytecode.object
    );
}

async function getWellContractAt(name, address) {
    const contractJson = JSON.parse(await fs.readFileSync(`${BASE_STRING}/${name}.sol/${name}.json`))
    return await ethers.getContractAt(
        contractJson.abi,
        address
    );
}

async function deployWellContract(name, arguments = []) {
    const Contract = await getWellContractFactory(name);
    const contract = await Contract.deploy(...arguments);
    await contract.deployed();
    return contract;
}

async function deployMockToken(name="MockToken", symbol="MOCK") {
    const MockToken = await ethers.getContractFactory('MockToken');
    const mockToken = await MockToken.deploy(name, symbol);
    await mockToken.deployed();
    return mockToken;
}

function encodeWellImmutableData(
    aquifer,
    tokens,
    wellFunction,
    pumps
) {
    let packedPumps = '0x';
    for (let i = 0; i < pumps.length; i++) {
        packedPumps = ethers.utils.solidityPack(
            ['bytes', 'address', 'uint256', 'bytes'],
            [
                packedPumps,            // previously packed pumps
                pumps[i].target,       // pump address
                pumps[i].length,  // pump data length
                pumps[i].data          // pump data (bytes)
            ]
        )
    }
    
    immutableData = ethers.utils.solidityPack(
        [
            'address',                  // aquifer address
            'uint256',                  // number of tokens
            'address',                  // well function address
            'uint256',                  // well function data length
            'uint256',                  // number of pumps
            'address[]',                // tokens array
            'bytes',                    // well function data (bytes)
            'bytes'                     // packed pumps (bytes)
        ], [
            aquifer,                    // aquifer address
            tokens.length,              // number of tokens
            wellFunction.target,        // well function address
            wellFunction.length,        // well function data length
            pumps.length,               // number of pumps
            tokens,                     // tokens array
            wellFunction.data,          // well function data (bytes)
            packedPumps                 // packed pumps (bytes)
        ]
    );
    return immutableData
}

async function encodeInitFunctionCall() {
    const well = await getWellContractFactory('Well');
    return well.interface.encodeFunctionData('init', ["Test", "Test"]);
}

async function deployWell(tokens, verbose = false, salt = ethers.constants.HashZero) {
    const wellImplementation = await deployWellContract('Well');
    if (verbose) console.log("Deployed Well Implementation", wellImplementation.address);
    const aquifer = await deployWellContract('Aquifer');
    if (verbose) console.log("Deployed Aquifer", aquifer.address);
    const wellFunction = await deployWellContract('ConstantProduct2');
    if (verbose) console.log("Deployed Well Function", wellFunction.address);
    const pump = await deployWellContract('GeoEmaAndCumSmaPump', [
        '0x3ffe0000000000000000000000000000', // 0.5e18
        '0x3ffd555555555555553cbcd83d925070', // 0.333333333333333333e18
        12,
        '0x3ffecccccccccccccccccccccccccccc' // 0.9e18
    ]);
    if (verbose) console.log("Deployed Pump", pump.address);

    const immutableData = await encodeWellImmutableData(
        aquifer.address,
        tokens,
        { target: wellFunction.address, data: '0x', length: 0 },
        [{target: pump.address, data: '0x', length: 0 }]
    )

    const initData = await encodeInitFunctionCall();

    if (verbose) console.log("Immutable Data", immutableData);
    if (verbose) console.log("Init Data", initData);

    const well = await aquifer.callStatic.boreWell(
        wellImplementation.address,
        immutableData,
        initData,
        salt
    );

    await aquifer.boreWell(
        wellImplementation.address,
        immutableData,
        initData,
        salt
    );

    if (verbose) console.log(`Well Deployed: ${well}`)

    return await ethers.getContractAt('IWell', well);
}

async function setReserves(account, well, amounts) {
    const tokens = await well.tokens()
    const reserves = await well.getReserves();
    let add = false
    const addAmounts = []
    let remove = false
    const removeAmounts = []

    for (let i = 0; i < tokens.length; i++) {
        if (reserves[i].gt(amounts[i])) {
            remove = true
            removeAmounts.push(reserves[i].sub(amounts[i]))
            addAmounts.push(ethers.constants.Zero)
        } else {
            add = true
            addAmounts.push(amounts[i].sub(reserves[i]))
            removeAmounts.push(ethers.constants.Zero)
            const mockToken = await ethers.getContractAt('MockToken', tokens[i])
            await mockToken.mint(
                account.address,
                amounts[i].sub(reserves[i])
            )
            await mockToken.connect(account).approve(
                well.address,
                ethers.constants.MaxUint256
            );
        }
    }

    if (add) {
        await well.connect(account).addLiquidity(
            addAmounts,
            ethers.constants.Zero,
            account.address,
            ethers.constants.MaxUint256
        )
    }
    if (remove) {
        await well.connect(account).removeLiquidityImbalanced(
            ethers.constants.MaxUint256,
            removeAmounts,
            account.address,
            ethers.constants.MaxUint256
        )
    }
}

async function whitelistWell(wellAddress, stalk, stalkEarnedPerSeason) {

    const beanstalk = await getBeanstalk()

    await beanstalk.connect(await impersonateBeanstalkOwner()).whitelistTokenWithEncodeType(
        wellAddress,
        beanstalk.interface.getSighash('wellBdv(address,uint256)'),
        stalk,
        stalkEarnedPerSeason,
        '0x01'
    )

}

exports.getWellContractFactory = getWellContractFactory;
exports.deployWell = deployWell;
exports.setReserves = setReserves;
exports.whitelistWell = whitelistWell;
exports.getWellContractAt = getWellContractAt