import { Address } from "@graphprotocol/graph-ts";
import { BoreWellPumpsStruct } from "../../generated/Aquifer/Aquifer";
import { Pump } from "../../generated/schema";

export function loadOrCreatePump(pumpData: BoreWellPumpsStruct, wellAddress: Address): Pump {
  let id = pumpData[0].toAddress().toHexString() + "-" + wellAddress.toHexString();
  let pump = Pump.load(id);
  if (pump == null) {
    pump = new Pump(id);
    pump.target = pumpData.target;
    pump.data = pumpData.data;
    pump.well = wellAddress;
    pump.save();
  }
  return pump as Pump;
}
