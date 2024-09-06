import { ethereum } from "@graphprotocol/graph-ts";
import { checkPegCrossEth as univ2_checkPegCrossEth } from "./LegacyUniswapV2Handler";
import { u32_binarySearchIndex } from "../../../../subgraph-core/utils/Math";
import { PEG_CROSS_BLOCKS, PEG_CROSS_BLOCKS_LAST } from "../../../cache-builder/results/PegCrossBlocks_eth";

export function handleBlock_v1(block: ethereum.Block): void {
  // Avoid checking for peg crosses on blocks which are already known to not have any cross.
  // The underlying methods do not write any data unless there is a cross
  if (block.number.toU32() > PEG_CROSS_BLOCKS_LAST || u32_binarySearchIndex(PEG_CROSS_BLOCKS, block.number.toU32()) != -1) {
    univ2_checkPegCrossEth(block);
  }
}
