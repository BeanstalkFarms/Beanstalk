import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BoreWellPumpsStruct, BoreWellWellFunctionStruct } from "../generated/Aquifer/Aquifer";
import { handleBoreWell } from "../src/templates/AquiferHandler";
import { BEAN_ERC20, WETH } from "../src/utils/Constants";
import { createBoreWellEvent } from "./event-mocking/Aquifer";

let well = Address.fromString('0x90767D012E17F8d1D2f7a257ECB951db703D7b3D')
let aquifer = Address.fromString('0xF6a8aD553b265405526030c2102fda2bDcdDC177')
let auger = Address.fromString('0x09120eAED8e4cD86D85a616680151DAA653880F2')
let wellFunction = Address.fromString('0x3E661784267F128e5f706De17Fac1Fc1c9d56f30')
let pump = Address.fromString('0x6732128F9cc0c4344b2d4DC6285BCd516b7E59E6')

describe("Aquifer Well Deployment", () => {
    afterEach(() => {
        clearStore()
    })

    test("Aquifer entity exists", () => {

        let wellFunctionTuple = new ethereum.Tuple()
        wellFunctionTuple.push(ethereum.Value.fromAddress(wellFunction))
        wellFunctionTuple.push(ethereum.Value.fromBytes(Bytes.empty()))

        let pump1Tuple = new ethereum.Tuple()
        pump1Tuple.push(ethereum.Value.fromAddress(pump))
        pump1Tuple.push(ethereum.Value.fromBytes(Bytes.empty()))

        let boreWellEvent = createBoreWellEvent(
            aquifer,
            well,
            [BEAN_ERC20, WETH],
            wellFunctionTuple,
            [pump1Tuple],
            auger
        )

        handleBoreWell(boreWellEvent)

        assert.fieldEquals("Aquifer", aquifer.toHexString(), "id", aquifer.toHexString())
    })
})
