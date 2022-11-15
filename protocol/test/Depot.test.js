const { expect } = require('chai');
const { defaultAbiCoder } = require('ethers/lib/utils.js');
const { deploy } = require('../scripts/deploy.js');
const { deployPipeline, impersonatePipeline } = require('../scripts/pipeline.js');
const { deployContract } = require('../scripts/contracts.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { signERC2612Permit } = require("eth-permit");
const { toBN, encodeAdvancedData, signSiloDepositTokenPermit, signSiloDepositTokensPermit, signTokenPermit } = require('../utils/index.js');
const { impersonateSigner } = require('../utils/signer.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js');
const { BEAN_3_CURVE, THREE_POOL, THREE_CURVE, STABLE_FACTORY, WETH, BEAN, PIPELINE } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { impersonateDepot } = require('../scripts/depot.js');

let user, user2, owner;

describe('Depot', function () {
    before(async function () {
        [owner, user, user2] = await ethers.getSigners();
        const contracts = await deploy("Test", false, true);
        this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
        this.mockSilo = await ethers.getContractAt('MockSiloFacet', contracts.beanstalkDiamond.address);
        this.bean = await getBean()
        this.usdc = await getUsdc()
        this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
        this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
        this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
        this.weth = await ethers.getContractAt("MockWETH", WETH)

        pipeline = await impersonatePipeline()
        this.depot = await impersonateDepot()

        this.erc1155 = await (await ethers.getContractFactory('MockERC1155', owner)).deploy('Mock')
        await this.erc1155.connect(user).setApprovalForAll(this.depot.address, true)

        this.erc721 = await (await ethers.getContractFactory('MockERC721', owner)).deploy()

        this.mockContract = await (await ethers.getContractFactory('MockContract', owner)).deploy()
        await this.mockContract.deployed()
        await this.mockContract.setAccount(user2.address)

        await this.bean.mint(user.address, to6('1004'))
        await this.usdc.mint(user.address, to6('1000'))

        await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
        await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))

        await this.bean.connect(user).approve(this.beanstalk.address, '100000000000')
        await this.bean.connect(user).approve(this.beanMetapool.address, '100000000000')
        await this.bean.mint(user.address, to6('10000'))

        await this.threeCurve.mint(user.address, to18('1000'))
        await this.threePool.set_virtual_price(to18('2'))
        await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'))

        await this.beanMetapool.set_A_precise('1000')
        await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'))
        await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'))
        await this.beanMetapool.connect(user).approve(this.beanstalk.address, to18('100000000000'))
        await this.threeCurve.connect(user).approve(this.beanstalk.address, to18('100000000000'))
        this.result = await this.beanstalk.connect(user).addLiquidity(
            BEAN_3_CURVE,
            STABLE_FACTORY,
            [to6('1000'), to18('1000')],
            to18('2000'),
            EXTERNAL,
            EXTERNAL
        )

        const SiloToken = await ethers.getContractFactory("MockToken");
        this.siloToken = await SiloToken.deploy("Silo", "SILO")
        await this.siloToken.deployed()
        await this.mockSilo.mockWhitelistToken(
            this.siloToken.address,
            this.mockSilo.interface.getSighash("mockBDV(uint256 amount)"),
            '10000',
            '1'
        );
        await this.siloToken.connect(user).approve(this.beanstalk.address, '100000000000');
        await this.siloToken.mint(user.address, to6('2'));

        await this.beanstalk.connect(user).deposit(BEAN, to6('1'), 0)
        await this.beanstalk.connect(user).deposit(this.siloToken.address, to6('1'), 0)
        await this.beanstalk.sunrise()
        await this.beanstalk.connect(user).deposit(BEAN, to6('1'), 0)
        await this.beanstalk.connect(user).transferToken(BEAN, user.address, to6('1'), EXTERNAL, INTERNAL)
    });

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    describe("Normal Pipe", async function () {
        describe("1 Pipe", async function () {
            beforeEach(async function () {
                const mintBeans = this.bean.interface.encodeFunctionData('mint', [
                    pipeline.address,
                    to6('100')
                ])
                await this.depot.connect(user).pipe([this.bean.address, mintBeans])
            })

            it('mints beans', async function () {
                expect(await this.bean.balanceOf(pipeline.address)).to.be.equal(to6('100'))
            })
        })
    })

    describe("Permit Deposit and Transfer Deposits (multiple seasons)", async function () {
        beforeEach(async function () {
            const nonce = await this.beanstalk.connect(user).depositPermitNonces(user.address);
            const signature = await signSiloDepositTokenPermit(user, user.address, this.depot.address, BEAN, to6('2'), nonce);
            permit = await this.depot.interface.encodeFunctionData('permitDeposit',
                [
                    signature.owner,
                    signature.spender,
                    signature.token,
                    signature.value,
                    signature.deadline,
                    signature.split.v,
                    signature.split.r,
                    signature.split.s
                ]
            )

            transfer = await this.depot.interface.encodeFunctionData('transferDeposits', [
                user.address,
                PIPELINE,
                BEAN,
                [1, 2],
                [to6('1'), to6('1')]
            ])
            await this.depot.connect(user).farm([permit, transfer])
        })

        it('pipeline has deposits', async function () {
            const deposit = await this.beanstalk.getDeposit(PIPELINE, BEAN, 1)
            expect(deposit[0]).to.be.equal(to6('1'))
            expect(deposit[1]).to.be.equal(to6('1'))
            const deposit2 = await this.beanstalk.getDeposit(PIPELINE, BEAN, 2)
            expect(deposit2[0]).to.be.equal(to6('1'))
            expect(deposit2[1]).to.be.equal(to6('1'))
        })

        it('user does not have deposits', async function () {
            const deposit = await this.beanstalk.getDeposit(user.address, BEAN, 1)
            expect(deposit[0]).to.be.equal(to6('0'))
            expect(deposit[1]).to.be.equal(to6('0'))
            const deposit2 = await this.beanstalk.getDeposit(user.address, BEAN, 2)
            expect(deposit2[0]).to.be.equal(to6('0'))
            expect(deposit2[1]).to.be.equal(to6('0'))
        })
    })

    describe("Permit Deposit and Transfer Deposits (multiple tokens)", async function () {
        beforeEach(async function () {
            const nonce = await this.beanstalk.connect(user).depositPermitNonces(user.address);
            const signature = await signSiloDepositTokensPermit(user, user.address, this.depot.address, [BEAN, this.siloToken.address], [to6('1'), to6('1')], nonce);
            permit = await this.depot.interface.encodeFunctionData('permitDeposits',
                [
                    signature.owner,
                    signature.spender,
                    signature.tokens,
                    signature.values,
                    signature.deadline,
                    signature.split.v,
                    signature.split.r,
                    signature.split.s
                ]
            )

            transfer = await this.depot.interface.encodeFunctionData('transferDeposit', [
                user.address,
                PIPELINE,
                BEAN,
                1,
                to6('1')
            ])

            transfer2 = await this.depot.interface.encodeFunctionData('transferDeposit', [
                user.address,
                PIPELINE,
                this.siloToken.address,
                1,
                to6('1')
            ])
            await this.depot.connect(user).farm([permit, transfer, transfer2])
        })

        it('pipeline has deposits', async function () {
            const deposit = await this.beanstalk.getDeposit(PIPELINE, BEAN, 1)
            expect(deposit[0]).to.be.equal(to6('1'))
            expect(deposit[1]).to.be.equal(to6('1'))
            const deposit2 = await this.beanstalk.getDeposit(PIPELINE, this.siloToken.address, 1)
            expect(deposit2[0]).to.be.equal(to6('1'))
            expect(deposit2[1]).to.be.equal(to6('1'))
        })

        it('user does not have deposits', async function () {
            const deposit = await this.beanstalk.getDeposit(user.address, BEAN, 1)
            expect(deposit[0]).to.be.equal(to6('0'))
            expect(deposit[1]).to.be.equal(to6('0'))
            const deposit2 = await this.beanstalk.getDeposit(user.address, this.siloToken.address, 1)
            expect(deposit2[0]).to.be.equal(to6('0'))
            expect(deposit2[1]).to.be.equal(to6('0'))
        })
    })

    describe("Deposit Transfer reverts with wrong sender", async function () {
        it("transferDeposit", async function () {
            await expect(this.depot.connect(user2).transferDeposit(
                user.address,
                PIPELINE,
                this.siloToken.address,
                1,
                to6('1')
            )).to.be.revertedWith("invalid sender")
        })

        it("transferDeposits", async function () {
            await expect(this.depot.connect(user2).transferDeposits(
                user.address,
                PIPELINE,
                this.siloToken.address,
                [1],
                [to6('1')]
            )).to.be.revertedWith("invalid sender")
        })
        
    })

    it("Reverts if not INTERNAL or EXTERNAL", async function () {
        await expect(this.depot.transferToken(
            this.siloToken.address,
            PIPELINE,
            to6('1'),
            INTERNAL_TOLERANT,
            EXTERNAL
        )).to.be.revertedWith("Mode not supported")
    })

    describe("Permit and Transfer ERC-20 token", async function () {
        beforeEach(async function () {
            const signature = await signERC2612Permit(
                ethers.provider,
                this.siloToken.address,
                user.address,
                this.depot.address,
                '10000000',
            );

            permit = this.beanstalk.interface.encodeFunctionData('permitERC20', [
                this.siloToken.address,
                signature.owner, 
                signature.spender, 
                signature.value,
                signature.deadline, 
                signature.v, 
                signature.r, 
                signature.s
            ]);

            transfer = await this.depot.interface.encodeFunctionData('transferToken', [
                this.siloToken.address,
                PIPELINE,
                to6('1'),
                EXTERNAL,
                EXTERNAL
            ])
            await this.depot.connect(user).farm([permit, transfer])
        })

        it('transfers token', async function () {
            expect(await this.siloToken.balanceOf(user.address)).to.be.equal(to6('0'))
            expect(await this.siloToken.balanceOf(PIPELINE)).to.be.equal(to6('1'))
        })
    })

    describe("Permit and Transfer ERC-20 token from Farm balances", async function () {
        beforeEach(async function () {
            const nonce = await this.beanstalk.tokenPermitNonces(user.address);
            const signature = await signTokenPermit(user, user.address, this.depot.address, BEAN, to6('1'), nonce);

            permit = this.beanstalk.interface.encodeFunctionData('permitToken', [
                signature.owner, 
                signature.spender, 
                signature.token, 
                signature.value, 
                signature.deadline, 
                signature.split.v, 
                signature.split.r, 
                signature.split.s
            ]);
            transfer = await this.depot.interface.encodeFunctionData('transferToken', [
                BEAN,
                PIPELINE,
                to6('1'),
                INTERNAL,
                EXTERNAL
            ])
            await this.depot.connect(user).farm([permit, transfer])
        })

        it('transfers token', async function () {
            expect(await this.beanstalk.getInternalBalance(BEAN, user.address)).to.be.equal(to6('0'))
            expect(await this.bean.balanceOf(PIPELINE)).to.be.equal(to6('1'))
        })
    })

    describe("Transfer ERC-1155", async function () {
        beforeEach(async function () {
            await this.erc1155.mockMint(user.address, '0', '5')
            await this.depot.connect(user).transferERC1155(this.erc1155.address, PIPELINE, '0', '2')
        })

        it('transfers ERC-1155', async function () {
            expect(await this.erc1155.balanceOf(PIPELINE, '0')).to.be.equal('2')
            expect(await this.erc1155.balanceOf(user.address, '0')).to.be.equal('3')
        })
    })

    describe("Batch Transfer ERC-1155", async function () {
        beforeEach(async function () {
            await this.erc1155.mockMint(user.address, '0', '5')
            await this.erc1155.mockMint(user.address, '1', '10')
            await this.depot.connect(user).batchTransferERC1155(this.erc1155.address, PIPELINE, ['0', '1'], ['2', '3'])
        })

        it('transfers ERC-1155', async function () {
            const balances = await this.erc1155.balanceOfBatch(
                [PIPELINE, PIPELINE, user.address, user.address], 
                ['0', '1', '0', '1']
            )
            expect(balances[0]).to.be.equal('2')
            expect(balances[1]).to.be.equal('3')
            expect(balances[2]).to.be.equal('3')
            expect(balances[3]).to.be.equal('7')
        })
    })

    describe("Transfer ERC-721", async function () {
        beforeEach(async function () {
            await this.erc721.mockMint(user.address, '0')
            await this.erc721.connect(user).approve(this.depot.address, '0')
            await this.depot.connect(user).transferERC721(this.erc721.address, PIPELINE, '0')
        })

        it('transfers ERC-721', async function () {
            expect(await this.erc721.ownerOf('0')).to.be.equal(PIPELINE)
        })
    })

    describe("Permit and transfer ERC-721", async function () {
        beforeEach(async function () {
            await this.erc721.mockMint(user.address, '0')
            const permit = this.depot.interface.encodeFunctionData("permitERC721", [
                this.erc721.address,
                this.depot.address,
                '0',
                '0',
                ethers.constants.HashZero
            ])
            const transfer = this.depot.interface.encodeFunctionData('transferERC721', [
                this.erc721.address, PIPELINE, '0'
            ])
            await this.depot.connect(user).farm([permit, transfer])
        })

        it('transfers ERC-721', async function () {
            expect(await this.erc721.ownerOf('0')).to.be.equal(PIPELINE)
        })
    })
})