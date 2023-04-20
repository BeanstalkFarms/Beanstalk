import { Chop as ChopEntity } from "../generated/schema";
import { Chop } from '../generated/Replant/Beanstalk'

export function handleChop(event: Chop): void {
    let id = 'chop-' + event.transaction.hash.toHexString() + '-' + event.transactionLogIndex.toString()
    let chop = new ChopEntity(id)
    chop.hash = event.transaction.hash.toHexString()
    chop.logIndex = event.transactionLogIndex.toI32()
    chop.protocol = event.address.toHexString()
    chop.farmer = event.params.account.toHexString()
    chop.unripe = event.params.token.toHexString()
    chop.amount = event.params.amount
    chop.underlying = event.params.underlying.toHexString()
    chop.blockNumber = event.block.number
    chop.createdAt = event.block.timestamp
    chop.save()
}
