import { Address, ByteArray, Bytes, log } from '@graphprotocol/graph-ts'
import { BoreWell } from '../../generated/Aquifer/Aquifer'
import { Well } from '../../generated/templates'
import { loadOrCreatePump } from '../utils/Pump'
import { loadOrCreateToken } from '../utils/Token'
import { loadOrCreateWell } from '../utils/Well'

export function handleBoreWell(event: BoreWell): void {

    Well.create(event.params.well)

    let well = loadOrCreateWell(event.params.well)
    let wellToken = loadOrCreateToken(event.params.well)

    well.aquifer = event.address
    well.name = wellToken.name
    well.symbol = wellToken.symbol
    well.liquidityToken = well.id
    well.liquidityTokenType = "ERC20"

    // A bit crude, but it works

    for (let i = 0; i < event.params.tokens.length; i++) {
        loadOrCreateToken(event.params.tokens[i])
    }

    if (event.params.tokens.length == 2) {
        well.inputTokens = [event.params.tokens[0], event.params.tokens[1]]
    } else if (event.params.tokens.length == 3) {
        well.inputTokens = [event.params.tokens[0], event.params.tokens[1], event.params.tokens[2]]
    } else if (event.params.tokens.length == 4) {
        well.inputTokens = [event.params.tokens[0], event.params.tokens[1], event.params.tokens[2], event.params.tokens[3]]
    }

    for (let i = 0; i < event.params.pumps.length; i++) {
        loadOrCreatePump(event.params.pumps[i][0].toAddress(), event.address)
    }

    well.wellFunction = event.params.wellFunction[0].toAddress()
    well.createdTimestamp = event.block.timestamp
    well.createdBlockNumber = event.block.number
    well.save()
}
