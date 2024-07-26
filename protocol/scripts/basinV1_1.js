const { BEAN, WETH, WSTETH, STETH_ETH_CHAINLINK_PRICE_AGGREGATOR, BEAN_WSTETH_WELL, ETH_USD_CHAINLINK_AGGREGATOR } = require("../test/utils/constants");
const { toX } = require("../test/utils/helpers");
const { getBean, toBN } = require("../utils");
const { deployWellContractAtNonce, encodeWellImmutableData, getWellContractAt, deployMockPump } = require("../utils/well");
const { getAccount, deployAquifer, deployWellImplementation } = require("./basin");

const BEAN_WSTETH_WELL_DEPLOYER = '0xF025fcD8C355F90a3e72C2099da54831e0850912';
const BEAN_WSTETH_WELL_DEPLOY_SALT = '0x8c5a1440b12f0eca90b905ed8a1d6ff0595c4192e23963e595e223f4780d10af';
const BEAN_WSTETH_WELL_NAME = 'BEAN:WSTETH Constant Product 2 Well'
const BEAN_WSTETH_WELL_SYMBOL = 'BEANWSTETHCP2w'
const BEAN_WSTETH_PUMP_DATA = '0x3ffecccccccccccccccccccccccccccc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000603ffe0000000000000000000000000000000000000000000000000000000000003ffde79e79e7c85cc2d20bcbc7308415000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003ffe00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023ffe0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

const CONSTANT_PRODUCT_2_DEPLOYER = '0xE48f0D5D69Ed147D678E86EB525465d056255210';
const CONSTANT_PRODUCT_2_DEPLOY_NONCE = 1;

const MULTI_FLOW_PUMP_DEPLOYER = '0x6EF5A1d8129F83C8b6CD3B368DD43Cd8A7a27a9A';
const MULTI_FLOW_PUMP_DEPLOY_NONCE = 1;

const ADD_LIQUIDITY_ADDRESS = BEAN_WSTETH_WELL_DEPLOYER;
const INITIAL_BEAN_LIQUIDITY = '1200000000';

async function deployBasinV1_1(mock=true, accounts = undefined, verbose = true, justDeploy = false, mockPump = false) {
    const c = {};
    c.aquifer = await deployAquifer(accounts, verbose);
    c.wellImplementation = await deployWellImplementation(accounts, verbose)
    return await deployBasinV1_1Upgrade(c, mock, accounts, verbose, justDeploy, mockPump);

}

async function deployBasinV1_1Upgrade(c, mock=true, accounts = undefined, verbose = true, justDeploy = false, mockPump=false, Wsteth = undefined) {
    if (c == undefined) {
        c = {
            aquifer: await getWellContractAt('Aquifer', '0xBA51AAAA95aeEFc1292515b36D86C51dC7877773'),
            wellImplementation: await getWellContractAt('Well', '0xBA510e11eEb387fad877812108a3406CA3f43a4B')
        }
    }
    account = await getAccount(accounts, 'constantProduct2', CONSTANT_PRODUCT_2_DEPLOYER);
    c.constantProduct2 = await deployWellContractAtNonce('ConstantProduct2', CONSTANT_PRODUCT_2_DEPLOY_NONCE, [], account, verbose, version = "1.1");

    account = await getAccount(accounts, 'multiFlowPump', MULTI_FLOW_PUMP_DEPLOYER);
    if (mockPump) {
        c.multiFlowPump = await deployMockPump('0xE42Df68A4c9Ba63A536523F5cd1c1e9214Ae8568')
        if (verbose) console.log("MultiFlowPump mocked at: 0xE42Df68A4c9Ba63A536523F5cd1c1e9214Ae8568")
    } else {
        c.multiFlowPump = await deployWellContractAtNonce('MultiFlowPump', MULTI_FLOW_PUMP_DEPLOY_NONCE, [], account, verbose, version = "1.1");
    }

    account = await getAccount(accounts, 'well', BEAN_WSTETH_WELL_DEPLOYER);

    const immutableData = encodeWellImmutableData(
        c.aquifer.address,
        [BEAN, WSTETH],
        { target: c.constantProduct2.address, data: '0x', length: 0 },
        [{ target: c.multiFlowPump.address, data: BEAN_WSTETH_PUMP_DATA, length: 480 }]
    );

    const initData = c.wellImplementation.interface.encodeFunctionData('init', [BEAN_WSTETH_WELL_NAME, BEAN_WSTETH_WELL_SYMBOL]);

    c.well = await getWellContractAt(
        'Well',
        await c.aquifer.connect(account).callStatic.boreWell(
            c.wellImplementation.address,
            immutableData,
            initData,
            BEAN_WSTETH_WELL_DEPLOY_SALT
        )
    );

    const wellTxn = await c.aquifer.connect(account).boreWell(
        c.wellImplementation.address,
        immutableData,
        initData,
        BEAN_WSTETH_WELL_DEPLOY_SALT
    )

    await wellTxn.wait();

    if (verbose) console.log("Bean:Steth Well Deployed at:", c.well.address);

    if (justDeploy) return c;

    if (verbose) console.log("");

    if (verbose) console.log("Adding Liquidity to Well...")

    const bean = await getBean();
    const wsteth = await ethers.getContractAt("MockWsteth", WSTETH);

    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    const stEthEthChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', STETH_ETH_CHAINLINK_PRICE_AGGREGATOR)
    const usdPerEth = (await ethUsdChainlinkAggregator.latestRoundData()).answer;
    const ethPerSteth = (await stEthEthChainlinkAggregator.latestRoundData()).answer;
    const stethPerWsteth = await wsteth.stEthPerToken();

    const usdPerWsteth = usdPerEth.mul(ethPerSteth).mul(stethPerWsteth).div(toX('1', 36));

    const amounts = [
        toBN(INITIAL_BEAN_LIQUIDITY),
        toBN(INITIAL_BEAN_LIQUIDITY).mul(toX('1', 20)).div(usdPerWsteth)
    ]

    if (verbose) console.log("Bean Amount:", amounts[0].toString());
    if (verbose) console.log("Wsteth Amount:", amounts[1].toString());

    if (verbose) console.log(account.address)

    if (verbose) console.log("Approving..");
    await bean.connect(account).approve(c.well.address, amounts[0]);
    await wsteth.connect(account).approve(c.well.address, amounts[1]);

    if (verbose) console.log("Obtaining Wsteth..");
    if (mock) {
        const mockWsteth = await ethers.getContractAt("MockToken", WSTETH);
        await mockWsteth.connect(account).mint(account.address, amounts[1]);
        const mockBean = await ethers.getContractAt("MockToken", BEAN);
        await mockBean.connect(account).mint(account.address, amounts[0]);
    }

    if (verbose) console.log('Adding Liquidity..')
    const lpAmountOut = c.well.getAddLiquidityOut(amounts);
    let txn = await c.well.connect(account).addLiquidity(amounts, lpAmountOut, account.address, ethers.constants.MaxUint256);
    await txn.wait();
    txn = await c.well.connect(account).addLiquidity([toBN('0'), toBN('0')], '0', account.address, ethers.constants.MaxUint256);
    await txn.wait();

    if (verbose) console.log('')

    const reserves = await c.well.getReserves();
    if (verbose) console.log("Well Statistics:")
    if (verbose) console.log("Bean Reserve:", reserves[0].toString());
    if (verbose) console.log("Wsteth Reserve:", reserves[1].toString());
    if (verbose) console.log("LP Token Total Supply:", (await c.well.totalSupply()).toString());

    if (verbose) console.log('')

    if (verbose) console.log("Pump Statistics:")
    const instantaneousReserves = await c.multiFlowPump.readInstantaneousReserves(
        c.well.address,
        BEAN_WSTETH_PUMP_DATA
    );
    if (verbose) console.log("Instantaneous Bean Reserve:", instantaneousReserves[0].toString());
    if (verbose) console.log("Instantaneous WETH Reserve:", instantaneousReserves[1].toString());

    if (verbose) console.log('')

    return c;

}

exports.deployBasinV1_1Upgrade = deployBasinV1_1Upgrade;
exports.deployBasinV1_1 = deployBasinV1_1