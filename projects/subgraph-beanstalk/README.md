<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

## Beanstalk Subgraph

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

**Indexes events emitted by [Beanstalk](https://etherscan.io/address/0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5).**

### Subgraphs

All currently used subgraphs live on a centralized host controlled by beanstalk farms.

- [Testing Subgraph](https://graph.node.bean.money/subgraphs/name/beanstalk-testing)
  - Used during local development for debugging and rapid iteration.
- [Dev Subgraph](https://graph.node.bean.money/subgraphs/name/beanstalk-dev)
  - Used for testing fixes or improvements made in the testing subgraph.
- [Canonical Subgraph](https://graph.node.bean.money/subgraphs/name/beanstalk)
  - Stable deployment and current source of truth for UI and other production processes.

### Testing

To test with Docker, the first time you will need to run `yarn run graph test -d`. This will build the `matchstick` Docker image. Then, you can use the `yarn testd` script to run all tests. Alternatively, use `yarn testd-named <TestName1> ...` to run specific tests. I have found running in Docker to be preferred since otherwise there can be issues with console output and some test cases fail silently.

### Deploying

When using graph cli commands, you will often need to specify which manifest file should be used. This is necessary to support multiple chains in the same codebase. The commands which need it will be evident - as they will fail when unable to find a `subgraph.yaml` file. In those commands, include `./manifest/${chain}.yaml` as the final argument to the command. See scripts inside `package.json` for examples.

It may be necessary to run `yarn build-cache` prior to a new deployment build. This updates historical cached values, particularly as it pertains to the L1 -> L2 migration. It will be necessary to re-run these scripts if updates to the L1 subgraph are made that need to have some values carried to the L2 subgraph. Note that it may not always be appropriate to run every script in the corresponding `cache-builder` directory, use with caution.

### Development

# Handler organization strategy

Any events that are currently relevant to Beanstalk should reference the codegen for whichever is the latest protocol ABI, and not include v1/v2 etc in the name. Legacy events (that are no longer present on-chain) should reference the codegen for the upgrade in which they were initially deployed, and use the appropriate version number in the method names. Legacy handlers should also be placed in the `legacy` folder.

Underlying logic should be included in a separate file provided in the `utils` folder. The advantage of this is in accommodating a scenario where an event signature gets updated. The replacement event handler can call into the shared util along with the legacy handler.
