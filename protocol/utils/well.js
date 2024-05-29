const fs = require('fs');
const { BEAN, WETH, BEANSTALK_PUMP, BEAN_ETH_WELL, BEAN_WSTETH_WELL, WSTETH, ZERO_ADDRESS } = require('../test/utils/constants');
const { to6, to18 } = require('../test/utils/helpers');
const { getBeanstalk } = require('./contracts');
const { impersonateBeanstalkOwner } = require('./signer');
const { increaseToNonce } = require('../scripts/contracts');
const { impersonateContract } = require('../scripts/impersonate');

const BASE_STRING = './node_modules/@beanstalk/wells/out';
const BASE_STRINGV1_1 = './node_modules/@beanstalk/wells1.1/out';

async function getWellContractFactory(name, account = undefined, version = "1.0") {
    const baseString = (version == "1.1") ? BASE_STRINGV1_1 : BASE_STRING
    const contractJson = JSON.parse(await fs.readFileSync(`${baseString}/${name}.sol/${name}.json`))
    return await ethers.getContractFactory(
        contractJson.abi,
        contractJson.bytecode.object,
        (account == undefined) ? await getWellDeployer() : account
    );
}

async function getWellContractAt(name, address, version = "1.0") {
    const baseString = (version == "1.1") ? BASE_STRINGV1_1 : BASE_STRING
    const contractJson = JSON.parse(await fs.readFileSync(`${baseString}/${name}.sol/${name}.json`))
    return await ethers.getContractAt(
        contractJson.abi,
        address
    );
}

async function deployWellContractAtNonce(name, nonce, arguments = [], account = undefined, verbose = false, version = "1.0") {
    await increaseToNonce(account, nonce)
    return await deployWellContract(name, arguments, account, verbose, version)
}

async function deployWellContract(name, arguments = [], account = undefined, verbose = false, version = "1.0") {
    const Contract = await getWellContractFactory(name, account, version);
    const contract = await Contract.deploy(...arguments);
    await contract.deployed();
    if (verbose) console.log(`${name} deployed at ${contract.address}`)
    return contract;
}

async function deployMockToken(name = "MockToken", symbol = "MOCK") {
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

async function deployWell(tokens, verbose = false, salt = ethers.constants.HashZero, mockPump = false) {
    const wellImplementation = await deployWellContract('Well');
    if (verbose) console.log("Deployed Well Implementation", wellImplementation.address);
    const aquifer = await deployWellContract('Aquifer');
    if (verbose) console.log("Deployed Aquifer", aquifer.address);
    const wellFunction = await deployWellContract('ConstantProduct2');
    if (verbose) console.log("Deployed Well Function", wellFunction.address);
    let pump;
    if(mockPump) {
        pump = await deployMockPump()
    } else {
        pump = await deployMultiFlowPump()
    }
    
    if (verbose) console.log("Deployed Pump", pump.address);

    const immutableData = await encodeWellImmutableData(
        aquifer.address,
        tokens,
        { target: wellFunction.address, data: '0x', length: 0 },
        [{ target: pump.address, data: '0x', length: 0 }]
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

async function impersonateBeanWstethWell() {
    const well = await deployWell([BEAN, WSTETH]);
    const bytecode = await ethers.provider.getCode(well.address)
    await network.provider.send("hardhat_setCode", [
        BEAN_WSTETH_WELL,
        bytecode,
    ]);
}

async function impersonateBeanEthWell() {
    const well = await deployWell([BEAN, WETH]);
    const bytecode = await ethers.provider.getCode(well.address)
    await network.provider.send("hardhat_setCode", [
        BEAN_ETH_WELL,
        bytecode,
    ]);
}

async function impersonateMockWell(well, pumpBalances = [to18('1'), to18('1')]) {
    well = await impersonateContract('MockSetComponentsWell', well)
    pump = await deployMockPump()
    wellFunction = await (await getWellContractFactory('ConstantProduct2')).deploy()
    await well.setPumps([[pump.address, '0x']])
    await well.setWellFunction([wellFunction.address, '0x'])
    await well.setTokens([BEAN, WETH])
    pump.setInstantaneousReserves(pumpBalances)
    await whitelistWell(well.address, '10000', to6('4'))
    return [well, pump, wellFunction]
}

async function whitelistWell(wellAddress, stalk, stalkEarnedPerSeason) {

    const beanstalk = await getBeanstalk()

    await beanstalk.connect(await impersonateBeanstalkOwner()).whitelistTokenWithEncodeType(
        wellAddress,
        beanstalk.interface.getSighash('wellBdv(address,uint256)'),
        stalk,
        stalkEarnedPerSeason,
        '0x01',
        beanstalk.interface.getSighash('defaultGaugePointFunction(uint256,uint256,uint256)'),
        beanstalk.interface.getSighash('maxWeight()'),
        '0',
        '0'
    )

}

async function deployMockPump(address=BEANSTALK_PUMP) {
    pump = await (await ethers.getContractFactory('MockPump')).deploy()
    await pump.deployed()
    await network.provider.send("hardhat_setCode", [
        address,
        await ethers.provider.getCode(pump.address),
    ]);
    return await ethers.getContractAt('MockPump', address)
}

async function deployMultiFlowPump() {
    pump = await (await getWellContractFactory('MultiFlowPump')).deploy(
        '0x3ffe0000000000000000000000000000', // 0.5
        '0x3ffd555555555555553cbcd83d925070', // 0.333333333333333333
        12,
        '0x3ffecccccccccccccccccccccccccccc' // 0.9
    )
    await pump.deployed()

    await network.provider.send("hardhat_setCode", [
        BEANSTALK_PUMP,
        await ethers.provider.getCode(pump.address),
    ]);
    return await getWellContractAt('MultiFlowPump', BEANSTALK_PUMP)
}

async function deployMockBeanWell(address, token1) {

    let wellFunction = await (await getWellContractFactory('ConstantProduct2', await getWellDeployer())).deploy()
    await wellFunction.deployed()

    let well = await (await ethers.getContractFactory('MockSetComponentsWell', await getWellDeployer())).deploy()
    await well.deployed()
    await network.provider.send("hardhat_setCode", [
        address,
        await ethers.provider.getCode(well.address),
    ]);
    well = await ethers.getContractAt('MockSetComponentsWell', address)
    token1contract = await ethers.getContractAt('MockToken', token1)
    await well.init()

    pump = await deployMultiFlowPump()

    await well.setPumps([[pump.address, '0x']])
    await well.setWellFunction([wellFunction.address, '0x'])
    await well.setTokens([BEAN, token1])

    await well.setReserves([to6('1000000'), to18('1000')])
    await well.setReserves([to6('1000000'), to18('1000')])
    let symbol = 'BEAN' + await token1contract.symbol() + await wellFunction.symbol() + 'w'
    await well.setSymbol(symbol)

    return [well, wellFunction, pump]
}

async function deployMockWell(tokens = [BEAN, WETH]) {

    let wellFunction = await (await getWellContractFactory('ConstantProduct2', await getWellDeployer())).deploy()
    await wellFunction.deployed()

    let well = await (await ethers.getContractFactory('MockSetComponentsWell', await getWellDeployer())).deploy()
    await well.deployed()
    well = await ethers.getContractAt('MockSetComponentsWell', well.address)
    await well.init()

    pump = await deployMultiFlowPump()

    await well.setWellFunction([wellFunction.address, '0x'])
    await well.setTokens(tokens)

    await well.setReserves([to6('1000000'), to18('1000')])
    await well.setReserves([to6('1000000'), to18('1000')])

    return well
}

async function deployMockWellWithMockPump(address = BEAN_ETH_WELL, token1 = WETH) {

    let wellFunction = await (await getWellContractFactory('ConstantProduct2', await getWellDeployer())).deploy()
    await wellFunction.deployed()

    let well = await (await ethers.getContractFactory('MockSetComponentsWell', await getWellDeployer())).deploy()
    await well.deployed()
    // if address is uninitalized, do not set code.
    if(address != ZERO_ADDRESS) { 
        await network.provider.send("hardhat_setCode", [
            address,
            await ethers.provider.getCode(well.address),
          ]);
        well = await ethers.getContractAt('MockSetComponentsWell', address)
    } else {
        well = await ethers.getContractAt('MockSetComponentsWell', well.address)
    }
    
    await well.init()

    pump = await deployMockPump()

    await well.setPumps([[pump.address, '0x']])
    await well.setWellFunction([wellFunction.address, '0x'])
    await well.setTokens([BEAN, token1])

    await well.setReserves([to6('1000000'), to18('1000')])
    await well.setReserves([to6('1000000'), to18('1000')])

    return [well, wellFunction, pump]
}

async function getWellDeployer() {
    return (await ethers.getSigners())[5]
}

exports.getWellContractFactory = getWellContractFactory;
exports.deployWell = deployWell;
exports.setReserves = setReserves;
exports.whitelistWell = whitelistWell;
exports.getWellContractAt = getWellContractAt
exports.deployMockBeanWell = deployMockBeanWell
exports.deployMockWell = deployMockWell
exports.deployMockPump = deployMockPump
exports.deployWellContract = deployWellContract
exports.deployWellContractAtNonce = deployWellContractAtNonce
exports.encodeWellImmutableData = encodeWellImmutableData
exports.impersonateMockWell = impersonateMockWell
exports.impersonateBeanEthWell = impersonateBeanEthWell
exports.impersonateBeanWstethWell = impersonateBeanWstethWell
exports.deployMockWellWithMockPump = deployMockWellWithMockPump