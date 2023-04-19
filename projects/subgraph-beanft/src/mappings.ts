import { log } from "@graphprotocol/graph-ts"
import {
  ConsecutiveTransfer as ConsecutiveTransferEventBarnRaise,
  Transfer as TransferEventBarnRaise
} from "../generated/barnraise/barnraise"
import {
  Transfer as TransferEventGenesis
} from "../generated/genesis/genesis"
import {
  Transfer as TransferEventWinter
} from "../generated/winter/winter"
import {
  User
} from "../generated/schema"

const zeroAddress = '0x0000000000000000000000000000000000000000'

export function handleTransferGenesis(event: TransferEventGenesis): void {
  log.info("GENESIS TRANSFER! BEANFT: {}, RECEIVER: {}", [event.params.tokenId.toI32().toString(), event.params.to.toHexString()])
  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  let tokenId = event.params.tokenId.toI32()
  transferHandler(from, to, tokenId, 'genesis')
}

export function handleTransferWinter(event: TransferEventWinter): void {
  log.info("WINTER TRANSFER! BEANFT: {}, RECEIVER: {}", [event.params.tokenId.toI32().toString(), event.params.to.toHexString()])
  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  let tokenId = event.params.tokenId.toI32()
  transferHandler(from, to, tokenId, 'winter')
}

export function handleTransferBarnRaise(event: TransferEventBarnRaise): void {
  log.info("BARN RAISE TRANSFER! BEANFT: {}, RECEIVER: {}", [event.params.tokenId.toI32().toString(), event.params.to.toHexString()])
  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  let tokenId = event.params.tokenId.toI32()
  transferHandler(from, to, tokenId, 'barnRaise')
}

export function handleConsecutiveTransferBarnRaise(event: ConsecutiveTransferEventBarnRaise): void {
  log.info("BARN RAISE CONSECUTIVE TRANSFER! FROM BEANFT {} TO {}, RECEIVER: {}", [event.params.fromTokenId.toString(), event.params.toTokenId.toString(), event.params.to.toHexString()])
  let fromTokenId = event.params.fromTokenId.toI32()
  let toTokenId = event.params.toTokenId.toI32()
  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  consecutiveTransferHandler(fromTokenId, toTokenId, from, to)
}

function transferHandler(from:string, to:string, tokenId:i32, mode:string): void {
  let source = User.load(from)
  let destination = User.load(to)
  if (source) { // If source is true this means it is a user wallet, as we make sure to not add the zero address as an user
    if (mode === 'genesis') {
      let nftIndex = source.genesis!.indexOf(tokenId)
      let genesisNew = source.genesis
      genesisNew!.splice(nftIndex, 1)
      source.genesis = genesisNew
    } else if (mode === 'winter') {
      let nftIndex = source.winter!.indexOf(tokenId)
      let winterNew = source.winter
      winterNew!.splice(nftIndex, 1)
      source.winter = winterNew
    } else if (mode === 'barnRaise') {
      let nftIndex = source.barnRaise!.indexOf(tokenId)
      let barnRaiseNew = source.barnRaise
      barnRaiseNew!.splice(nftIndex, 1)
      source.barnRaise = barnRaiseNew
    } else {
      log.critical("TRANSFER HANDLER - MODE MISSING", [])
    }
    source.save()
  }
  if (destination) { // If true we have indexed the receiver as an user already, just update the arrays
    if (mode === 'genesis') {
      let genesisNew = destination.genesis
      genesisNew!.push(tokenId)
      destination.genesis = genesisNew
    } else if (mode === 'winter') {
      let winterNew = destination.winter
      winterNew!.push(tokenId)
      destination.winter = winterNew
    } else if (mode === 'barnRaise') {
      let barnRaiseNew = destination.barnRaise
      barnRaiseNew!.push(tokenId)
      destination.barnRaise = barnRaiseNew
    } else {
      log.critical("TRANSFER HANDLER - MODE MISSING", [])
    }
    destination.save()
  } else if (to !== zeroAddress) { // This is a new user, so initialize the arrays. This check also makes sure we don't index the zero address
    destination = new User(to)
    destination.id = to
    destination.genesis = new Array<i32>()
    destination.winter = new Array<i32>()
    destination.barnRaise = new Array<i32>()
    if (mode === 'genesis') {
      let genesisNew = destination.genesis
      genesisNew!.push(tokenId)
      destination.genesis = genesisNew
    } else if (mode === 'winter') {
      let winterNew = destination.winter
      winterNew!.push(tokenId)
      destination.winter = winterNew
    } else if (mode === 'barnRaise') {
      let barnRaiseNew = destination.barnRaise
      barnRaiseNew!.push(tokenId)
      destination.barnRaise = barnRaiseNew
    } else {
      log.critical("TRANSFER HANDLER - MODE MISSING", [])
    }
    destination.save()
  }
}

function consecutiveTransferHandler(fromTokenId:i32, toTokenId:i32, from:string, to:string): void {
  let totalNFTsSent = (toTokenId - fromTokenId) + 1
  for (let i = 0; i < totalNFTsSent; i++) {
    let sender = User.load(from)
    let receiver = User.load(to)
    let tokenId = fromTokenId + i
    if (sender) {
      let nftIndex = sender.barnRaise!.indexOf(tokenId)
      let barnRaiseNew = sender.barnRaise
      barnRaiseNew!.splice(nftIndex, 1)
      sender.barnRaise = barnRaiseNew
      sender.save() 
    }
    if (receiver) {
      let barnRaiseNew = receiver.barnRaise
      barnRaiseNew!.push(tokenId)
      receiver.barnRaise = barnRaiseNew
      receiver.save()
    } 
    else if (to !== zeroAddress) {
      receiver = new User(to)
      receiver.id = to
      receiver.genesis = new Array<i32>()
      receiver.winter = new Array<i32>()
      receiver.barnRaise = new Array<i32>()
      let barnRaiseNew = receiver.barnRaise
      barnRaiseNew!.push(tokenId)
      receiver.barnRaise = barnRaiseNew
      receiver.save()
    }
  }
}