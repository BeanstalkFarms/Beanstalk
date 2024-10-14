import { BoreWellPumpsStruct } from "../../generated/Basin-ABIs/Aquifer";
import { Pump } from "../../generated/schema";

export function loadOrCreatePump(pumpData: BoreWellPumpsStruct): Pump {
  let id = pumpData.target.toHexString();
  let pump = Pump.load(id);
  if (pump == null) {
    pump = new Pump(id);
    pump.target = pumpData.target;
    pump.save();
  }
  return pump as Pump;
}
