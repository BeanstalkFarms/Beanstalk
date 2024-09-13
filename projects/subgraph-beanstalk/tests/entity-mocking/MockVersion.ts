import { handleInitVersion } from "../../src/utils/constants/Version";
import { mockBlock } from "../../../subgraph-core/tests/event-mocking/Block";
import { BEANSTALK_BLOCK } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";

export function initL1Version(): void {
  handleInitVersion(mockBlock(BEANSTALK_BLOCK));
}
