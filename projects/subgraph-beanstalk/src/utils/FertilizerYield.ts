import { FertilizerYield } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadFertilizerYield(season: i32): FertilizerYield {
    let fertilizerYield = FertilizerYield.load(season.toString())
    if (fertilizerYield == null) {
        fertilizerYield = new FertilizerYield(season.toString())
        fertilizerYield.season = season
        fertilizerYield.humidity = ZERO_BD
        fertilizerYield.outstandingFert = ZERO_BI
        fertilizerYield.beansPerSeasonEMA = ZERO_BD
        fertilizerYield.deltaBpf = ZERO_BD
        fertilizerYield.simpleAPY = ZERO_BD
        fertilizerYield.createdAt = ZERO_BI
        fertilizerYield.save()
    }
    return fertilizerYield as FertilizerYield
}
