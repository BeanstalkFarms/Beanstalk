const { EXTERNAL, INTERNAL } = require("../test/utils/balances");
const { BEAN, BEAN_3_CURVE, PUBLIUS, BEANSTALK } = require("../test/utils/constants");
const { impersonateSigner, mintEth, getBean, getBeanstalk, signSiloDepositTokenPermit, signSiloDepositTokensPermit, encodeAdvancedData, toBN } = require("../utils");
const { signERC2612Permit } = require("eth-permit");
const { getPipeline, getRoot } = require("../utils/contracts");
const { to18 } = require("../test/utils/helpers");
const { printGasUsed } = require("../utils/helpers");

const MOCK_ROOT_DEPLOYER = '0x48CCD287c3D62A09F01210b9fa0b78f44769d1De'

async function deploy(mock = true, account = undefined) {

    if (mock) {
        account = await impersonateSigner(MOCK_ROOT_DEPLOYER)
        await mintEth(MOCK_ROOT_DEPLOYER)
    }
    root = await ethers.getContractFactory("Root", {
        signer: account,
    });
    root = await upgrades.deployProxy(root, ["Root", "ROOT"], {
        initializer: "initialize",
    });
    console.log(`Root Token deployed at ${root.address}`);

    await root.connect(account).addWhitelistToken(BEAN);
    console.log(`Whitelisted Bean: ${await root.whitelisted(BEAN)}`)

    return root
}

// Deposit a Token and mint Roots with the new Deposit through Pipeline and a Beanstalk Farm function call.
// toMode specifies whether to mint Roots to internal or external
async function depositAndMintRoot(account, token, amount, toMode) {

    root = await getRoot()
    bean = await getBean()
    beanstalk = await getBeanstalk()
    pipeline = await getPipeline()

    // Generate ERC-20 Permit to transfer Beans from Farmer to Beanstalk
    erc20permit = await signERC2612Permit(
        ethers.provider,
        token,
        account.address,
        beanstalk.address,
        amount.toString()
    )
    season = await beanstalk.season()

    // Encode permit function call to execute permit.
    const permit = beanstalk.interface.encodeFunctionData(
        "permitERC20", [
        token,
        account.address,
        beanstalk.address,
        amount,
        erc20permit.deadline,
        erc20permit.v,
        erc20permit.r,
        erc20permit.s
    ])

    // Encode permit function call to deposit
    const transferToken = beanstalk.interface.encodeFunctionData(
        "transferToken", [
        token,
        pipeline.address,
        amount,
        EXTERNAL,
        EXTERNAL
    ]
    );


    // Pipeline
    const deposit = beanstalk.interface.encodeFunctionData(
        "deposit", [token, amount, EXTERNAL]
    );
    const approveDeposit = beanstalk.interface.encodeFunctionData(
        "approveDeposit", [root.address, token, ethers.constants.MaxUint256] // Pipeline can approve anything so infinite is okay
    )
    const approveTransfer2 = bean.interface.encodeFunctionData(
        "approve", [BEANSTALK, ethers.constants.MaxUint256] // Pipeline can approve anything so infinite is okay
    )

    const approveTransfer = root.interface.encodeFunctionData(
        "approve", [BEANSTALK, ethers.constants.MaxUint256] // Pipeline can approve anything so infinite is okay
    )
    const mintRoot = root.interface.encodeFunctionData(
        'mint', [
        [
            {
                token: token,
                seasons: [season],
                amounts: [amount],
            },
        ],
        EXTERNAL
    ]
    )
    const transferRoots = beanstalk.interface.encodeFunctionData(
        "transferToken", [
        root.address,
        account.address,
        '0', // Will be overwritten by advancedData
        EXTERNAL,
        toMode
    ]
    )
    const basicData = await encodeAdvancedData(0)
    const advancedTransferData = await encodeAdvancedData(1, toBN('0'), [4, 32, 100]) // Copy first return value to first callData 

    const pipeMintRoot = beanstalk.interface.encodeFunctionData(
        "advancedPipe", [
        [
            [bean.address, approveTransfer2, basicData], // Note: Pipeline approval calls could be not necessary if already non-zero
            [beanstalk.address, approveDeposit, basicData],
            [root.address, approveTransfer, basicData],
            [beanstalk.address, deposit, basicData],
            [root.address, mintRoot, basicData],
            [beanstalk.address, transferRoots, advancedTransferData]
        ],
        '0'
    ]
    )

    const result = await beanstalk.connect(account).farm([
        permit,
        transferToken,
        pipeMintRoot
    ])
    await printGasUsed(result)
    return root
}


// Mint Roots using Token Deposits of a single token of given Seasons and amounts directly through Root using a permit
// toMode specifies where to mint Roots to
async function mintRoot(account, token, seasons, amounts, toMode) {

    root = await getRoot()
    bean = await getBean()
    beanstalk = await getBeanstalk()

    depositPermit = await signSiloDepositTokenPermit(
        account,
        account.address,
        root.address,
        token,
        amounts.reduce((acc, a) => acc.add(toBN(a)), toBN('0')).toString(),
        await beanstalk.connect(account).depositPermitNonces(account.address)
    );

    await root.connect(account).mintWithTokenPermit(
        [
            {
                token: token,
                seasons: seasons,
                amounts: amounts,
            },
        ],
        toMode,
        depositPermit.token,
        depositPermit.value,
        depositPermit.deadline,
        depositPermit.split.v,
        depositPermit.split.r,
        depositPermit.split.s
    );
}

// Mint Roots using Token Deposits of multiple tokens given Seasons and amounts directly through Root using a permit
// toMode specifies where to mint Roots to
async function mintRootFromTokens(account, transfers, toMode) {

    root = await getRoot()
    bean = await getBean()
    beanstalk = await getBeanstalk()
    depositPermit = await signSiloDepositTokensPermit(
        account,
        account.address,
        root.address,
        transfers.map((t) => t[0]),
        transfers.map((t) => t[2].reduce((acc, a) => acc.add(toBN(a)), toBN('0')).toString()),
        await beanstalk.connect(account).depositPermitNonces(account.address)
    );

    await root.connect(account).mintWithTokensPermit(
        transfers,
        toMode,
        depositPermit.tokens,
        depositPermit.values,
        depositPermit.deadline,
        depositPermit.split.v,
        depositPermit.split.r,
        depositPermit.split.s
    );
}

exports.deployRoot = deploy
exports.mintRoot = mintRoot
exports.depositAndMintRoot = depositAndMintRoot
exports.mintRootFromTokens = mintRootFromTokens