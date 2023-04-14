import { Address } from "@graphprotocol/graph-ts";
import { SiloWithdraw } from "../../generated/schema";
import { ZERO_BI } from "./Decimals";

export function loadSiloWithdraw(account: Address, token: Address, season: i32): SiloWithdraw {
    let id = account.toHexString() + '-' + token.toHexString() + '-' + season.toString()
    let withdraw = SiloWithdraw.load(id)
    if (withdraw == null) {
        withdraw = new SiloWithdraw(id)
        withdraw.farmer = account.toHexString()
        withdraw.token = token.toHexString()
        withdraw.withdrawSeason = season
        withdraw.claimableSeason = season + 1
        withdraw.claimed = false
        withdraw.amount = ZERO_BI
        withdraw.hashes = []
        withdraw.createdAt = ZERO_BI
        withdraw.save()
    }
    return withdraw as SiloWithdraw
}
