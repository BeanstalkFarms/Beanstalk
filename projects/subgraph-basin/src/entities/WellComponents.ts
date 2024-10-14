import { Address } from "@graphprotocol/graph-ts";
import { Aquifer, Implementation, Pump, WellFunction } from "../../generated/schema";
import { BoreWellPumpsStruct } from "../../generated/Basin-ABIs/Aquifer";

export function loadOrCreateAquifer(aquiferAddress: Address): Aquifer {
  let aquifer = Aquifer.load(aquiferAddress);
  if (aquifer == null) {
    aquifer = new Aquifer(aquiferAddress);
    aquifer.save();
  }
  return aquifer as Aquifer;
}

export function loadOrCreateImplementation(implAddress: Address): Implementation {
  let impl = Implementation.load(implAddress);
  if (impl == null) {
    impl = new Implementation(implAddress);
    impl.save();
  }
  return impl as Implementation;
}

export function loadOrCreatePump(pumpData: BoreWellPumpsStruct): Pump {
  let pump = Pump.load(pumpData.target);
  if (pump == null) {
    pump = new Pump(pumpData.target);
    pump.save();
  }
  return pump as Pump;
}

export function loadOrCreateWellFunction(wellFnAddress: Address): WellFunction {
  let wellFunction = WellFunction.load(wellFnAddress);
  if (wellFunction == null) {
    wellFunction = new WellFunction(wellFnAddress);
    wellFunction.save();
  }
  return wellFunction as WellFunction;
}
