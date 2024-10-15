import { BASIN_BLOCK } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { mockBlock } from "../../../subgraph-core/tests/event-mocking/Block";
import { handleInitVersion } from "../../src/utils/constants/Version";

export function initL1Version(): void {
  handleInitVersion(mockBlock(BASIN_BLOCK));
}
