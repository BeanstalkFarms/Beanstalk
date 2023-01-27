import { Address, ByteArray, Bytes, log } from '@graphprotocol/graph-ts'
import { BoreWell } from '../../generated/Aquifer/Aquifer'
import { Well } from '../../generated/templates'
import { loadOrCreatePump } from '../utils/Pump'
import { loadOrCreateToken } from '../utils/Token'
import { loadOrCreateWell } from '../utils/Well'

export function handleBoreWell(event: BoreWell): void {
    Well.create(event.params.well)

    let tokens = ['']
    for (let i = 0; i < event.params.tokens.length; i++) {
        loadOrCreateToken(event.params.tokens[i])
        tokens.push(event.params.tokens[i].toHexString())
    }

    let pumps = ['']

    for (let i = 0; i < event.params.pumps.length; i++) {
        let pump = loadOrCreatePump(event.params.pumps[i][0].toAddress())
        pumps.push(pump.id)
    }

    let well = loadOrCreateWell(event.params.well)
    well.tokens = tokens
    well.wellFunction = event.params.wellFunction[0].toAddress()
    well.pumps = pumps
    well.auger = event.params.auger
    well.save()
}
