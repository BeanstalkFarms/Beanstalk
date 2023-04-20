import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Plot } from "../../generated/schema";
import { ADDRESS_ZERO } from "./Constants";
import { ZERO_BI } from "./Decimals";
import { loadField } from "./Field";

export function loadPlot(diamondAddress: Address, index: BigInt): Plot {
    let plot = Plot.load(index.toString())
    if (plot == null) {
        plot = new Plot(index.toString())
        plot.field = diamondAddress.toHexString()
        plot.farmer = ADDRESS_ZERO.toHexString()
        plot.source = 'SOW' // Assume new plots come from sowing
        plot.season = 0
        plot.creationHash = ''
        plot.createdAt = ZERO_BI
        plot.updatedAt = ZERO_BI
        plot.index = index
        plot.beans = ZERO_BI
        plot.pods = ZERO_BI
        plot.sownPods = ZERO_BI
        plot.temperature = 0
        plot.harvestablePods = ZERO_BI
        plot.harvestedPods = ZERO_BI
        plot.fullyHarvested = false
        plot.save()

        let field = loadField(diamondAddress)
        field.plotIndexes.push(plot.index)
        field.save()

    }
    return plot
}
