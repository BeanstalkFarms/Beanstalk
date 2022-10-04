const { to18, toBean } = require('./utils/helpers.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { WETH, BEANSTALK } = require('./utils/constants');
const { signERC2612Permit } = require("eth-permit");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

describe('Token', function () {

    function checkAllBalance(ab, ib, eb, b) {
        expect(ab[0]).to.equal(ib)
        expect(ab[1]).to.equal(eb)
        expect(ab[2]).to.equal(b)
    }

    before(async function () {
        let [u1, u2, r] = await ethers.getSigners();
        this.user = u1; this.user2 = u2; this.recipient = r;
        const contracts = await deploy("Test", false, true)
        this.tokenFacet = await ethers.getContractAt('TokenFacet', contracts.beanstalkDiamond.address)
        this.farm = await ethers.getContractAt('FarmFacet', contracts.beanstalkDiamond.address)

        const MockToken = await ethers.getContractFactory('MockToken')
        this.token = await MockToken.connect(this.user).deploy('Mock', 'MOCK')
        await this.token.deployed()
        await this.token.connect(this.user).mint(this.user.address, '1000')
        await this.token.connect(this.user2).mint(this.user2.address, '1000')
        await this.token.connect(this.user).approve(this.tokenFacet.address, to18('1000000000000000'))

        this.token2 = await MockToken.connect(this.user).deploy('Mock', 'MOCK')
        await this.token2.deployed()
        await this.token2.connect(this.user).mint(this.user.address, '1000')
        await this.token2.connect(this.user).approve(this.tokenFacet.address, to18('1000000000000000'))

        this.weth = await ethers.getContractAt('IWETH', WETH)
        await this.weth.connect(this.user).approve(this.tokenFacet.address, to18('1000000000000000'))
    });

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });

    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    describe('Balance functions', async function () {
        beforeEach(async function () {
            await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '100', EXTERNAL, INTERNAL);
            await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user2.address, '200', EXTERNAL, INTERNAL);
            await this.tokenFacet.connect(this.user).transferToken(this.token2.address, this.user.address, '250', EXTERNAL, INTERNAL);
        })

        it('Tracks internal balance', async function () {
        expect(await this.tokenFacet.getInternalBalance(this.user.address, this.token.address)).to.equal('100')
        expect(await this.tokenFacet.getInternalBalance(this.user2.address, this.token.address)).to.equal('200')
        const internalBalances = await this.tokenFacet.getInternalBalances(this.user.address, [this.token.address, this.token2.address])
        expect(internalBalances[0]).to.equal('100')
        expect(internalBalances[1]).to.equal('250')
        })

        it('Tracks external balance', async function () {
        expect(await this.tokenFacet.getExternalBalance(this.user.address, this.token.address)).to.equal('700')
        expect(await this.tokenFacet.getExternalBalance(this.user2.address, this.token.address)).to.equal('1000')
        const externalBalances = await this.tokenFacet.getExternalBalances(this.user.address, [this.token.address, this.token2.address])
        expect(externalBalances[0]).to.equal('700')
        expect(externalBalances[1]).to.equal('750')
        })

        it('Tracks balance', async function () {
        expect(await this.tokenFacet.getBalance(this.user.address, this.token.address)).to.equal('800')
        expect(await this.tokenFacet.getBalance(this.user2.address, this.token.address)).to.equal('1200')
        const balances = await this.tokenFacet.getBalances(this.user.address, [this.token.address, this.token2.address])
        expect(balances[0]).to.equal('800')
        expect(balances[1]).to.equal('1000')
        })

        it ('Tracks all balances', async function () {
        checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '100', '700', '800')
        checkAllBalance(await this.tokenFacet.getAllBalance(this.user2.address, this.token.address), '200', '1000', '1200')
        const allBalances = await this.tokenFacet.getAllBalances(this.user.address, [this.token.address, this.token2.address])
        checkAllBalance(allBalances[0], '100', '700', '800')
        checkAllBalance(allBalances[1], '250', '750', '1000')
        })
    })

    describe('transfer', async function () {
        describe('External to external', async function () {
            it('basic', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '200', EXTERNAL, EXTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '800', '800')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '0', '200', '200')
            })
        })

        describe('External to internal', async function () {
            it('basic', async function () {
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '200', EXTERNAL, INTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '800', '800')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '200', '0', '200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.recipient.address, this.token.address, '200')
            })
        })

        describe('internal to internal', async function () {
            it('reverts if > than internal, not tolerant', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '200', EXTERNAL, INTERNAL);
                await expect(this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '300', INTERNAL, INTERNAL)).to.be.revertedWith("Balance: Insufficient internal balance")
            })
            it('internal', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '200', EXTERNAL, INTERNAL);
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '200', INTERNAL, INTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '800', '800')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '200', '0', '200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.user.address, this.token.address, '-200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.recipient.address, this.token.address, '200')
            })

            it('internal tolerant', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '200', EXTERNAL, INTERNAL);
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '300', INTERNAL_EXTERNAL, INTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '700', '700')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '300', '0', '300')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.user.address, this.token.address, '-200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.recipient.address, this.token.address, '300')
            })

            it('internal + external', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '200', EXTERNAL, INTERNAL);
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '250', INTERNAL_TOLERANT, INTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '800', '800')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '200', '0', '200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.user.address, this.token.address, '-200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.recipient.address, this.token.address, '200')
            })

            it('0 internal tolerant', async function () {
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '0', INTERNAL_TOLERANT, INTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '1000', '1000')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '0', '0', '0')
            })
        })

        describe('internal to external', async function () {
            it('basic', async function () {
                await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.user.address, '200', EXTERNAL, INTERNAL);
                this.result = await this.tokenFacet.connect(this.user).transferToken(this.token.address, this.recipient.address, '200', INTERNAL, EXTERNAL);
                checkAllBalance(await this.tokenFacet.getAllBalance(this.user.address, this.token.address), '0', '800', '800')
                checkAllBalance(await this.tokenFacet.getAllBalance(this.recipient.address, this.token.address), '0', '200', '200')
                await expect(this.result).to.emit(this.tokenFacet, 'InternalBalanceChanged').withArgs(this.user.address, this.token.address, '-200')
            })
        })
    })

    describe("weth", async function () {
        it('deposit WETH to external', async function () {
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            await this.tokenFacet.connect(this.user).wrapEth(to18('1'), EXTERNAL, { value: to18('1') })
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('1'), to18('1.001'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('1'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('0'))
        })

        it('deposit WETH to external, not all', async function () {
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            await this.tokenFacet.connect(this.user).wrapEth(to18('1'), EXTERNAL, { value: to18('2') })
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('1'), to18('1.001'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('1'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('0'))
        })

        it('deposit WETH to external, not all, farm', async function () {
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            const wrapEth = await this.tokenFacet.interface.encodeFunctionData("wrapEth", [to18('1'), EXTERNAL]);
            await this.farm.connect(this.user).farm([wrapEth], { value: to18('2') })
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('1'), to18('1.001'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('1'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('0'))
        })

        it('withdraw WETH from external', async function () {
            await this.tokenFacet.connect(this.user).wrapEth(to18('1'), EXTERNAL, { value: to18('1') })
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            await this.tokenFacet.connect(this.user).unwrapEth(to18('1'), EXTERNAL)
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('-1'), to18('-0.999'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('0'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('0'))
        })

        it('deposit WETH to external', async function () {
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            await this.tokenFacet.connect(this.user).wrapEth(to18('1'), INTERNAL, { value: to18('1') })
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('1'), to18('1.001'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('0'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('1'))
        })

        it('withdraw WETH from exteranl', async function () {
            await this.tokenFacet.connect(this.user).wrapEth(to18('1'), INTERNAL, { value: to18('1') })
            const ethBefore = await ethers.provider.getBalance(this.user.address)
            await this.tokenFacet.connect(this.user).unwrapEth(to18('1'), INTERNAL)
            expect(ethBefore.sub(await ethers.provider.getBalance(this.user.address))).to.be.within(to18('-1'), to18('-0.999'))
            expect(await this.weth.balanceOf(this.user.address)).to.eq(to18('0'))
            expect(await this.tokenFacet.getInternalBalance(this.user.address, WETH)).to.eq(to18('0'))
        })
    })

    describe("Permit", async function () {
        before(async function() {
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [BEANSTALK],
            });
    
            [owner, user, user2] = await ethers.getSigners()
    
            const Bean = await ethers.getContractFactory("Bean", owner)
            bean = await Bean.deploy()
            await bean.deployed();
            await bean.mint(user.address, toBean('100'))

            result = await signERC2612Permit(
                ethers.provider,
                bean.address,
                user.address,
                owner.address,
                '10000000'
            );

            fakeResult = await signERC2612Permit(
                ethers.provider,
                user.address,
                user.address,
                owner.address,
                '10000000'
            );

            endedResult = await signERC2612Permit(
                ethers.provider,
                user.address,
                user.address,
                owner.address,
                '10000000',
                '1'
            );
        });

        it('revert if fake permit', async function () {
            await expect(this.tokenFacet.connect(user).permitERC20(
                bean.address,
                user.address,
                owner.address,
                toBean('10'),
                fakeResult.deadline,
                fakeResult.v,
                fakeResult.r,
                fakeResult.s
            )).to.be.revertedWith('ERC20Permit: invalid signature')
        });

        it('revert when too much', async function () {
            await this.tokenFacet.connect(user).permitERC20(
                bean.address,
                user.address, 
                owner.address, 
                toBean('10'), 
                result.deadline, 
                result.v, 
                result.r, 
                result.s
            )

            await expect(bean.connect(owner).transferFrom(user.address, user2.address, toBean('20'))).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
        });

        it('revert deadline passed', async function () {
            await expect(this.tokenFacet.connect(user).permitERC20(
                bean.address,
                user.address, 
                owner.address, 
                toBean('10'), 
                endedResult.deadline, 
                endedResult.v, 
                endedResult.r, 
                endedResult.s
            )).to.be.revertedWith("ERC20Permit: expired deadline")
        });
    });
});
