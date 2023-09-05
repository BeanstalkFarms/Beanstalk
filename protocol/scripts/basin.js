const { BEAN, WETH, BEANSTALK_FARMS, ETH_USD_CHAINLINK_AGGREGATOR, PRICE_DEPLOYER } = require("../test/utils/constants");
const { toX } = require("../test/utils/helpers");
const { impersonateSigner, toBN, getBean, impersonateBeanstalkOwner } = require("../utils");
const { deployWellContractAtNonce, encodeWellImmutableData, getWellContractAt } = require("../utils/well");
const { bipBasinIntegration } = require("./bips");
const { deployContract } = require("./contracts");
const { deployPriceContract } = require("./price");

const MULTI_FLOW_PUMP_MAX_PERCENT_INCREASE = '0x3ff50624dd2f1a9fbe76c8b439581062'; // 0.001
const MULTI_FLOW_PUMP_MAX_PERCENT_DECREASE = '0x3ff505e1d27a3ee9bffd7f3dd1a32671'; // 1 - 1 / (1 + .001)
const MULTI_FLOW_PUMP_CAP_INTERVAL = 12; // 12 seconds
const MULTI_FLOW_PUMP_ALPHA = '0x3ffeef368eb04325c526c2246eec3e55'; // 0.967213114754098360 = 1 - 2 / (1 + blocks) where blocks = 60

const AQUIFER_DEPLOYER = '0xc5890Cc9Db6CEb7c5039337582b3b921863C5CD1';
const AQUIFER_DEPLOY_NONCE = 9;

const CONSTANT_PRODUCT_2_DEPLOYER = '0xe1132AcbA9E2bFEca5EA71822387538053C5716b';
const CONSTANT_PRODUCT_2_DEPLOY_NONCE = 5;

const MULTI_FLOW_PUMP_DEPLOYER = '0x350dc53714D1741a86A781A48c8E3ef1664803Dc';
const MULTI_FLOW_PUMP_DEPLOY_NONCE = 5;

const WELL_IMPLEMENTATION_DEPLOYER = '0x9c789Db7BAc3524eb89739DeD1Ec0b8Bd49e02Bc';
const WELL_IMPLEMENTATION_DEPLOY_NONCE = 8;

const WELL_DEPLOYER = '0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64';
const WELL_DEPLOY_SALT = '0x8c5a1440b12f0eca90b905ed8a1d6ff0595c4192e23963e595e223f4780d10af';
const WELL_NAME = 'BEAN:WETH Constant Product 2 Well'
const WELL_SYMBOL = 'BEANWETHCP2w'

const ADD_LIQUIDITY_ADDRESS = WELL_DEPLOYER;
const INITIAL_BEAN_LIQUIDITY = '1200000000';

async function deployBasinAndIntegrationBip(mock, bipAccount = undefined, basinAccounts = undefined, priceContractAccount = undefined) {
    await deployBasin(mock, basinAccounts);
    await deployPriceContract(priceContractAccount);
    await bipBasinIntegration(mock, bipAccount);
}

async function deployBasin(mock = true, accounts = undefined, verbose = true, justDeploy = false) {

    if (verbose) console.log("Deploying Basin...")

    let account = await getAccount(accounts, 'aquifer', AQUIFER_DEPLOYER);
    const aquifer = await deployWellContractAtNonce('Aquifer', AQUIFER_DEPLOY_NONCE, [], account, verbose);

    account = await getAccount(accounts, 'constantProduct2', CONSTANT_PRODUCT_2_DEPLOYER);
    const constantProduct2 = await deployWellContractAtNonce('ConstantProduct2', CONSTANT_PRODUCT_2_DEPLOY_NONCE, [], account, verbose);

    account = await getAccount(accounts, 'multiFlowPump', MULTI_FLOW_PUMP_DEPLOYER);
    let multiFlowPump = await deployWellContractAtNonce('MultiFlowPump', MULTI_FLOW_PUMP_DEPLOY_NONCE, [
        MULTI_FLOW_PUMP_MAX_PERCENT_INCREASE,
        MULTI_FLOW_PUMP_MAX_PERCENT_DECREASE,
        MULTI_FLOW_PUMP_CAP_INTERVAL,
        MULTI_FLOW_PUMP_ALPHA
    ], account, verbose);

    account = await getAccount(accounts, 'wellImplementation', WELL_IMPLEMENTATION_DEPLOYER);
    const wellImplementation = await deployWellContractAtNonce('Well', WELL_IMPLEMENTATION_DEPLOY_NONCE, [], account, false);
    if (verbose) console.log("Well Implementation Deployed at", wellImplementation.address);

    account = await getAccount(accounts, 'well', WELL_DEPLOYER);
    const immutableData = encodeWellImmutableData(
        aquifer.address,
        [BEAN, WETH],
        { target: constantProduct2.address, data: '0x', length: 0 },
        [{ target: multiFlowPump.address, data: '0x', length: 0 }]
    );

    const initData = wellImplementation.interface.encodeFunctionData('init', [WELL_NAME, WELL_SYMBOL]);

    const well = await getWellContractAt(
        'Well',
        await aquifer.connect(account).callStatic.boreWell(
            wellImplementation.address,
            immutableData,
            initData,
            WELL_DEPLOY_SALT
        )
    );

    const wellTxn = await aquifer.connect(account).boreWell(
        wellImplementation.address,
        immutableData,
        initData,
        WELL_DEPLOY_SALT
    );

    await wellTxn.wait();

    if (justDeploy) return well;

    if (verbose) console.log("Bean:Eth Well Deployed at:", well.address);

    if (verbose) console.log("");

    if (verbose) console.log("Adding Liquidity to Well...")

    account = await getAccount(accounts, 'addLiquidity', ADD_LIQUIDITY_ADDRESS);

    const bean = await getBean();
    const weth = await ethers.getContractAt("IWETH", WETH);

    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    const beanEthPrice = (await ethUsdChainlinkAggregator.latestRoundData()).answer;

    if (verbose) console.log("Bean:Eth Price:", beanEthPrice.toString());

    const amounts = [
        toBN(INITIAL_BEAN_LIQUIDITY),
        toBN(INITIAL_BEAN_LIQUIDITY).mul(toX('1', 20)).div(beanEthPrice)
    ]

    if (verbose) console.log("Bean Amount:", amounts[0].toString());
    if (verbose) console.log("Eth Amount:", amounts[1].toString());

    if (verbose) console.log(account.address)

    if (verbose) onsole.log("Approving..");
    await bean.connect(account).approve(well.address, amounts[0]);
    await weth.connect(account).approve(well.address, amounts[1]);

    if (verbose) console.log("Wrapping Eth..");
    await weth.connect(account).deposit({ value: amounts[1] });

    if (verbose) console.log('Adding Liquidity..')
    const lpAmountOut = well.getAddLiquidityOut(amounts);
    let txn = await well.connect(account).addLiquidity(amounts, lpAmountOut, account.address, ethers.constants.MaxUint256);
    await txn.wait();
    txn = await well.connect(account).addLiquidity([toBN('0'), toBN('0')], '0', account.address, ethers.constants.MaxUint256);
    await txn.wait();

    if (verbose) console.log('')

    const reserves = await well.getReserves();
    if (verbose) console.log("Well Statistics:")
    if (verbose) console.log("Bean Reserve:", reserves[0].toString());
    if (verbose) console.log("Eth Reserve:", reserves[1].toString());
    if (verbose) console.log("LP Token Total Supply:", (await well.totalSupply()).toString());

    if (verbose) console.log('')

    if (verbose) console.log("Pump Statistics:")
    const instantaneousReserves = await multiFlowPump.readInstantaneousReserves(
        well.address,
        "0x"
    );
    if (verbose) console.log("Instantaneous Bean Reserve:", instantaneousReserves[0].toString());
    if (verbose) console.log("Instantaneous WETH Reserve:", instantaneousReserves[1].toString());

    if (verbose) console.log('')
}

async function getAccount(accounts, key, mockAddress) {
    if (accounts == undefined) {
        return await impersonateSigner(mockAddress, true);
    }
    return accounts[key];
}

exports.deployBasin = deployBasin;
exports.deployBasinAndIntegrationBip = deployBasinAndIntegrationBip;