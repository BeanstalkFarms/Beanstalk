import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../src/utils/Constants";
import { ZERO_BI } from "../src/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import { ACCOUNT_ENTITY_TYPE, BEAN_SWAP_AMOUNT, DEPOSIT_ENTITY_TYPE, POSITION_ENTITY_TYPE, POSITION_ID, SWAP_ACCOUNT, SWAP_ENTITY_TYPE, WELL, WELL_ENTITY_TYPE, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT, WITHDRAW_ENTITY_TYPE } from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { createDefaultSwap } from "./helpers/Swap";
import { createDefaultAddLiquidity, createDefaultRemoveLiquidity, createRemoveLiquidityOneBean, createRemoveLiquidityOneWeth, loadWithdraw } from "./helpers/Liquidity";
import { loadDeposit } from "./helpers/Liquidity";
import { loadPosition } from "../src/utils/Position";

describe("Well Entity: Single Event Tests", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    describe("Add Liquidity", () => {
        test("Deposit counter incremented", () => {
            createDefaultAddLiquidity()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'cumulativeDepositCount', '1')
        })
        test("Token Balances updated", () => {
            createDefaultAddLiquidity()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.inputTokenBalances

            assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0])
            assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1])
        })
        test("Liquidity Token balance", () => {
            createDefaultAddLiquidity()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'totalLiquidity', WELL_LP_AMOUNT.toString())
        })
    })

    describe("Remove Liquidity", () => {
        test("Withdraw counter incremented", () => {
            createDefaultRemoveLiquidity()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'cumulativeWithdrawCount', '1')
        })
        test("Token Balances updated", () => {
            createDefaultRemoveLiquidity()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.inputTokenBalances

            assert.bigIntEquals(ZERO_BI.minus(BEAN_SWAP_AMOUNT), endingBalances[0])
            assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1])
        })
        test("Liquidity Token balance", () => {
            createDefaultRemoveLiquidity()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'totalLiquidity', ZERO_BI.minus(WELL_LP_AMOUNT).toString())
        })
    })

    describe("Remove Liquidity One - Bean", () => {
        test("Withdraw counter incremented", () => {
            createRemoveLiquidityOneBean()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'cumulativeWithdrawCount', '1')
        })
        test("Token Balances updated", () => {
            createRemoveLiquidityOneBean()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.inputTokenBalances

            assert.bigIntEquals(ZERO_BI.minus(BEAN_SWAP_AMOUNT), endingBalances[0])
            assert.bigIntEquals(ZERO_BI, endingBalances[1])
        })
        test("Liquidity Token balance", () => {
            createRemoveLiquidityOneBean()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'totalLiquidity', ZERO_BI.minus(WELL_LP_AMOUNT).toString())
        })
    })

    describe("Remove Liquidity One - WETH", () => {
        test("Withdraw counter incremented", () => {
            createRemoveLiquidityOneWeth()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'cumulativeWithdrawCount', '1')
        })
        test("Token Balances updated", () => {
            createRemoveLiquidityOneWeth()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.inputTokenBalances

            assert.bigIntEquals(ZERO_BI, endingBalances[0])
            assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1])
        })
        test("Liquidity Token balance", () => {
            createRemoveLiquidityOneWeth()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'totalLiquidity', ZERO_BI.minus(WELL_LP_AMOUNT).toString())
        })
    })

    describe("Swap", () => {
        test("Swap counter incremented", () => {
            createDefaultSwap()
            assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), 'cumulativeSwapCount', '1')
        })

        test("Token Balances updated", () => {
            createDefaultSwap()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.inputTokenBalances

            assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0])
            assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1])
        })

        test("Token Volumes updated", () => {
            createDefaultSwap()

            let updatedStore = loadWell(WELL)
            let endingBalances = updatedStore.cumulativeVolumeTokenAmounts

            assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0])
            assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1])
        })
    })
})

describe("Position Entity: Single Event Tests", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    describe("Add Liquidity", () => {
        test("Deposit counter incremented", () => {
            createDefaultAddLiquidity()
            assert.fieldEquals(POSITION_ENTITY_TYPE, POSITION_ID, 'depositCount', '1')
        })
        test("Token Balances updated", () => {
            createDefaultAddLiquidity()

            let updatedStore = loadPosition(SWAP_ACCOUNT, WELL)
            let endingBalances = updatedStore.cumulativeDepositTokenAmounts

            assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0])
            assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1])
        })
        test("Liquidity Token balance", () => {
            createDefaultAddLiquidity()
            assert.fieldEquals(POSITION_ENTITY_TYPE, POSITION_ID, 'liquidity', WELL_LP_AMOUNT.toString())
        })
    })
})

describe("Swap Entity", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    test("Swap entity exists", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'id', id)
    })
    test("Account entity exists", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), 'id', SWAP_ACCOUNT.toHexString())
    })
    test("Well value", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'well', WELL.toHexString())
    })
    test("fromToken value", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'fromToken', BEAN_ERC20.toHexString())
    })
    test("amountIn value", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'amountIn', BEAN_SWAP_AMOUNT.toString())
    })
    test("toToken value", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'toToken', WETH.toHexString())
    })
    test("amountOut value", () => {
        let id = createDefaultSwap()
        assert.fieldEquals(SWAP_ENTITY_TYPE, id, 'amountOut', WETH_SWAP_AMOUNT.toString())
    })
})

describe("AddLiquidity => Deposit Entity", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    test("Deposit entity exists", () => {
        let id = createDefaultAddLiquidity()
        assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, 'id', id)
    })
    test("Account entity exists", () => {
        let id = createDefaultAddLiquidity()
        assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), 'id', SWAP_ACCOUNT.toHexString())
    })
    test("Well value", () => {
        let id = createDefaultAddLiquidity()
        assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, 'well', WELL.toHexString())
    })
    test("lpAmountOut => liquidity value", () => {
        let id = createDefaultAddLiquidity()
        assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, 'liquidity', WELL_LP_AMOUNT.toString())
    })
    test("inputTokens value", () => {
        let id = createDefaultAddLiquidity()

        let updatedStore = loadDeposit(id)
        let inputTokens = updatedStore.inputTokens

        assert.bytesEquals(BEAN_ERC20, inputTokens[0])
        assert.bytesEquals(WETH, inputTokens[1])
    })
    test("inputTokenAmounts value", () => {
        let id = createDefaultAddLiquidity()

        let updatedStore = loadDeposit(id)
        let inputTokenAmounts = updatedStore.inputTokenAmounts

        assert.bigIntEquals(BEAN_SWAP_AMOUNT, inputTokenAmounts[0])
        assert.bigIntEquals(WETH_SWAP_AMOUNT, inputTokenAmounts[1])
    })
})

describe("RemoveLiquidity => Withdraw Entity", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    test("Withdraw entity exists", () => {
        let id = createDefaultRemoveLiquidity()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'id', id)
    })
    test("Account entity exists", () => {
        let id = createDefaultRemoveLiquidity()
        assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), 'id', SWAP_ACCOUNT.toHexString())
    })
    test("Well value", () => {
        let id = createDefaultRemoveLiquidity()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'well', WELL.toHexString())
    })
    test("lpAmountIn => liquidity value", () => {
        let id = createDefaultRemoveLiquidity()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'liquidity', WELL_LP_AMOUNT.toString())
    })
    test("inputTokens value", () => {
        let id = createDefaultRemoveLiquidity()

        let updatedStore = loadWithdraw(id)
        let inputTokens = updatedStore.inputTokens

        assert.bytesEquals(BEAN_ERC20, inputTokens[0])
        assert.bytesEquals(WETH, inputTokens[1])
    })
    test("inputTokenAmounts value", () => {
        let id = createDefaultRemoveLiquidity()

        let updatedStore = loadWithdraw(id)
        let inputTokenAmounts = updatedStore.inputTokenAmounts

        assert.bigIntEquals(BEAN_SWAP_AMOUNT, inputTokenAmounts[0])
        assert.bigIntEquals(WETH_SWAP_AMOUNT, inputTokenAmounts[1])
    })
})

describe("RemoveLiquidityOneToken => Withdraw Entity", () => {
    beforeEach(() => {
        boreDefaultWell()
    })

    afterEach(() => {
        clearStore()
    })

    test("Withdraw entity exists", () => {
        let id = createRemoveLiquidityOneBean()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'id', id)
    })
    test("Account entity exists", () => {
        let id = createRemoveLiquidityOneBean()
        assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), 'id', SWAP_ACCOUNT.toHexString())
    })
    test("Well value", () => {
        let id = createRemoveLiquidityOneBean()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'well', WELL.toHexString())
    })
    test("lpAmountIn => liquidity value", () => {
        let id = createRemoveLiquidityOneBean()
        assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, 'liquidity', WELL_LP_AMOUNT.toString())
    })
    test("inputTokens value", () => {
        let id = createRemoveLiquidityOneBean()

        let updatedStore = loadWithdraw(id)
        let inputTokens = updatedStore.inputTokens

        assert.bytesEquals(BEAN_ERC20, inputTokens[0])
        assert.bytesEquals(WETH, inputTokens[1])
    })
    test("inputTokenAmounts value", () => {
        let id = createRemoveLiquidityOneBean()

        let updatedStore = loadWithdraw(id)
        let inputTokenAmounts = updatedStore.inputTokenAmounts

        assert.bigIntEquals(BEAN_SWAP_AMOUNT, inputTokenAmounts[0])
        assert.bigIntEquals(ZERO_BI, inputTokenAmounts[1])
    })
})
