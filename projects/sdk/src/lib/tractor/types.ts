import { ethers } from "ethers";

export type Bytes = string;
export type Bytes32 = string;
export type uint80 = string;

export type Blueprint = {
    publisher: string;
    data: Bytes;
    operatorPasteInstrs: Bytes32[];
    maxNonce: number;
    startTime: number;
    endTime: number;
}


export type Requisition = {
    blueprint: Blueprint;
    blueprintHash: Bytes32;
    signature: Bytes;
}


function toBytes32(data: number) {
    return ethers.utils.hexlify(ethers.utils.zeroPad(data.toString(), 32));
}
