import { BigInt } from "@graphprotocol/graph-ts";
import { handleInitVersion } from "../../src/utils/constants/Version";
import { mockBlock } from "../../../subgraph-core/tests/event-mocking/Block";

export function initL1Version(): void {
  handleInitVersion(mockBlock(BigInt.fromU32(12974075)));
}
