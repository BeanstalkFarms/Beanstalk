import { Auger as AugerContract } from "../constants/generated";
import { WellsSDK } from "./WellsSDK";
export declare class Auger {
    sdk: WellsSDK;
    readonly address: string;
    readonly contract: AugerContract;
    constructor(sdk: WellsSDK, address: string);
}
