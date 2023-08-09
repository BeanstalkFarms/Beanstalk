const { BEAN, WETH, BEANSTALK_FARMS, ETH_USD_CHAINLINK_AGGREGATOR, PRICE_DEPLOYER } = require("../test/utils/constants");
const { toX } = require("../test/utils/helpers");
const { impersonateSigner, toBN, getBean, impersonateBeanstalkOwner } = require("../utils");
const { deployWellContractAtNonce, encodeWellImmutableData, getWellContractAt } = require("../utils/well");
const { bipBasinIntegration } = require("./bips");
const { deployContract } = require("./contracts");
const { deployPriceContract } = require("./price");

const MULTI_FLOW_PUMP_MAX_PERCENT_INCREASE = '0x3ffb9999999999999999999999999999'; // TODO: Set
const MULTI_FLOW_PUMP_MAX_PERCENT_DECREASE = '0x3ffb745d1745cfdaf20b87765b895188'; // TODO: Set
const MULTI_FLOW_PUMP_CAP_INTERVAL = 12;
const MULTI_FLOW_PUMP_ALPHA = '0x3ffecccccccccccccccccccccccccccc'; // TODO: Set

const AQUIFER_DEPLOYER = '0xc5890Cc9Db6CEb7c5039337582b3b921863C5CD1'; // TODO: Set
const AQUIFER_DEPLOY_NONCE = 9; // TODO: Set

const CONSTANT_PRODUCT_2_DEPLOYER = '0xe1132AcbA9E2bFEca5EA71822387538053C5716b'; // TODO: Set
const CONSTANT_PRODUCT_2_DEPLOY_NONCE = 5; // TODO: Set

const MULTI_FLOW_PUMP_DEPLOYER = '0x350dc53714D1741a86A781A48c8E3ef1664803Dc'; // TODO: Set
const MULTI_FLOW_PUMP_DEPLOY_NONCE = 5; // TODO: Set

const WELL_IMPLEMENTATION_DEPLOYER = '0x15e6e03ddb9682F3ea6458886c7ceA0e07bbb6d9'; // TODO: Set
const WELL_IMPLEMENTATION_DEPLOY_NONCE = 2; // TODO: Set

const WELL_DEPLOYER = '0x7eaE23DD0f0d8289d38653BCE11b92F7807eFB64'; // TODO: Set
const WELL_DEPLOY_SALT = '0x0000000000000000000000000000000000000000000000000000000000000001'; // TODO: Set
const WELL_NAME = 'BEAN:WETH Constant Product 2 Well'
const WELL_SYMBOL = 'BEANWETHCP2w'

const ADD_LIQUIDITY_ADDRESS = BEANSTALK_FARMS; // TODO: Set
const INITIAL_BEAN_LIQUIDITY = '2000000000'; // 1000e6

async function deployBasinAndIntegrationBip(mock, bipAccount = undefined, basinAccounts = undefined, priceContractAccount = undefined) {
    await deployBasin(mock, basinAccounts);
    await deployPriceContract(priceContractAccount);
    await bipBasinIntegration(mock, bipAccount);
}

async function deployBasin(mock = true, accounts = undefined) {

    console.log("Deploying Basin...")

    let account = await getAccount(accounts, 'aquifer', AQUIFER_DEPLOYER);
    const aquifer = await deployWellContractAtNonce('Aquifer', AQUIFER_DEPLOY_NONCE, [], account, true);

    account = await getAccount(accounts, 'constantProduct2', CONSTANT_PRODUCT_2_DEPLOYER);
    const constantProduct2 = await deployWellContractAtNonce('ConstantProduct2', CONSTANT_PRODUCT_2_DEPLOY_NONCE, [], account, true);

    account = await getAccount(accounts, 'multiFlowPump', MULTI_FLOW_PUMP_DEPLOYER);
    let multiFlowPump = await deployWellContractAtNonce('MultiFlowPump', MULTI_FLOW_PUMP_DEPLOY_NONCE, [
        MULTI_FLOW_PUMP_MAX_PERCENT_INCREASE,
        MULTI_FLOW_PUMP_MAX_PERCENT_DECREASE,
        MULTI_FLOW_PUMP_CAP_INTERVAL,
        MULTI_FLOW_PUMP_ALPHA
    ], account, true);

    account = await getAccount(accounts, 'wellImplementation', WELL_IMPLEMENTATION_DEPLOYER);
    const wellImplementation = await deployWellContractAtNonce('Well', WELL_IMPLEMENTATION_DEPLOY_NONCE, [], account, false);
    console.log("Well Implementation Deployed at", wellImplementation.address);

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
        await aquifer.callStatic.boreWell(
            wellImplementation.address,
            immutableData,
            initData,
            WELL_DEPLOY_SALT
        )
    );

    await aquifer.boreWell(
        wellImplementation.address,
        immutableData,
        initData,
        WELL_DEPLOY_SALT
    );

    console.log("Bean:Eth Well Deployed at:", well.address);

    console.log("");

    console.log("Adding Liquidity to Well...")

    account = await getAccount(accounts, 'addLiquidity', ADD_LIQUIDITY_ADDRESS);

    const bean = await getBean();
    const weth = await ethers.getContractAt("IWETH", WETH);

    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    const beanEthPrice = (await ethUsdChainlinkAggregator.latestRoundData()).answer;

    console.log("Bean:Eth Price:", beanEthPrice.toString());

    const amounts = [
        toBN(INITIAL_BEAN_LIQUIDITY),
        toBN(INITIAL_BEAN_LIQUIDITY).mul(toX('1', 20)).div(beanEthPrice)
    ]

    console.log("Bean Amount:", amounts[0].toString());
    console.log("Eth Amount:", amounts[1].toString());

    console.log(account.address)

    console.log("Approving..");
    await bean.connect(account).approve(well.address, amounts[0]);
    await weth.connect(account).approve(well.address, amounts[1]);

    console.log("Wrapping Eth..");
    await weth.connect(account).deposit({ value: amounts[1] });

    console.log('Adding Liquidity..')
    const lpAmountOut = well.getAddLiquidityOut(amounts);
    let txn = await well.connect(account).addLiquidity(amounts, lpAmountOut, account.address, ethers.constants.MaxUint256);
    await txn.wait();
    txn = await well.connect(account).addLiquidity([toBN('0'), toBN('0')], '0', account.address, ethers.constants.MaxUint256);
    await txn.wait();

    console.log('')

    const reserves = await well.getReserves();
    console.log("Well Statistics:")
    console.log("Bean Reserve:", reserves[0].toString());
    console.log("Eth Reserve:", reserves[1].toString());
    console.log("LP Token Total Supply:", (await well.totalSupply()).toString());

    console.log('')

    console.log("Pump Statistics:")
    const instantaneousReserves = await multiFlowPump.readInstantaneousReserves(
        well.address,
        "0x"
    );
    console.log("Instantaneous Bean Reserve:", instantaneousReserves[0].toString());
    console.log("Instantaneous WETH Reserve:", instantaneousReserves[1].toString());

    console.log('')
}

async function getAccount(accounts, key, mockAddress) {
    if (accounts == undefined) {
        return await impersonateSigner(mockAddress, true);
    }
    return accounts[key];
}

exports.deployBasin = deployBasin;
exports.deployBasinAndIntegrationBip = deployBasinAndIntegrationBip;