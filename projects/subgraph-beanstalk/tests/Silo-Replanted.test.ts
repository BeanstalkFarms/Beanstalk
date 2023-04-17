import { BigInt } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { handleAddDeposit, handleRemoveDeposit } from "../src/SiloHandler";
import { BEAN_ERC20 } from "../src/utils/Constants";
import { createAddDepositEvent, createRemoveDepositEvent } from "./event-mocking/Silo";

describe("Mocked Events", () => {
    afterEach(() => {
        clearStore()
    })

    describe("Bean", () => {
        test("AddDeposit - Silo and Assets updated", () => {

            let account = '0x1234567890abcdef1234567890abcdef12345678'.toLowerCase()
            let token = BEAN_ERC20.toHexString().toLowerCase()

            let newAddDepositEvent = createAddDepositEvent(
                account,
                token,
                6100,
                1000,
                6,
                1000
            )

            handleAddDeposit(newAddDepositEvent)

            assert.fieldEquals("Silo", account, "depositedBDV", "1000000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedBDV", "1000000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedAmount", "1000000000")
        })

        test("RemoveDeposit - Farmer Silo Amounts 50% Initial", () => {

            let account = '0x1234567890abcdef1234567890abcdef12345678'.toLowerCase()
            let token = BEAN_ERC20.toHexString().toLowerCase()

            let newAddDepositEvent = createAddDepositEvent(
                account,
                token,
                6100,
                1000,
                6,
                1000
            )

            handleAddDeposit(newAddDepositEvent)

            let newRemoveDepositEvent = createRemoveDepositEvent(
                account,
                token,
                6100,
                BigInt.fromString('500000000')
            )

            handleRemoveDeposit(newRemoveDepositEvent)

            assert.fieldEquals("Silo", account, "depositedBDV", "500000000")
            assert.fieldEquals("SiloDeposit", account + '-' + token + '-6100', "withdrawnAmount", "500000000")
            assert.fieldEquals("SiloDeposit", account + '-' + token + '-6100', "withdrawnBDV", "500000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedBDV", "500000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedAmount", "500000000")
        })

        test("RemoveDeposit - Farmer Silo Amounts 50% Remaining", () => {

            let account = '0x1234567890abcdef1234567890abcdef12345678'.toLowerCase()
            let token = BEAN_ERC20.toHexString().toLowerCase()

            let newAddDepositEvent = createAddDepositEvent(
                account,
                token,
                6100,
                1000,
                6,
                1000
            )

            handleAddDeposit(newAddDepositEvent)

            let newRemoveDepositEvent = createRemoveDepositEvent(
                account,
                token,
                6100,
                BigInt.fromString('500000000')
            )

            handleRemoveDeposit(newRemoveDepositEvent)

            let secondRemoveDepositEvent = createRemoveDepositEvent(
                account,
                token,
                6100,
                BigInt.fromString('250000000')
            )

            handleRemoveDeposit(secondRemoveDepositEvent)

            assert.fieldEquals("Silo", account, "depositedBDV", "250000000")
            assert.fieldEquals("SiloDeposit", account + '-' + token + '-6100', "withdrawnAmount", "750000000")
            assert.fieldEquals("SiloDeposit", account + '-' + token + '-6100', "withdrawnBDV", "750000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedBDV", "250000000")
            assert.fieldEquals("SiloAsset", account + '-' + token, "depositedAmount", "250000000")
        })
    })
})
