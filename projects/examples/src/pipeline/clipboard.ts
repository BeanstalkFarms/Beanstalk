import { sdk } from "../setup";
import { Clipboard } from "@beanstalk/sdk";
import { ethers } from "ethers";

function log(x: string[]) {
  x.forEach((s) => console.log(s));
}

function pad(str: string, label: string, n = 32) {
  return `${str.padEnd(n, ".")} ${label}`;
}

// 2 hex chars = 1 byte
// 1 hex char  = 0.5 byte
// 128 hex char = 64 bytes
// shift by 1 byte, 2 hex chars with "0x" in string
function display(_data: string) {
  const data = _data.substring(2); // clip start
  log([
    _data,
    pad("0x", "hex"),
    pad(data.substring(0, 2), "type"),
    pad(data.substring(2, 4), "use ether?"),
    pad(data.substring(4, 4 + 2 * 32), "ether value"), // FIXME
    // ...todo...
    ""
  ]);
}

display(Clipboard.encode([]));
// ['bytes2', 'uint256'] + ['0x0001', ethers.utils.parseEther('1').toString()]
display(Clipboard.encode([], ethers.utils.parseEther("1")));
