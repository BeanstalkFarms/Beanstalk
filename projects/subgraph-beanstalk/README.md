<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

## Beanstalk Subgraph

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

**Indexes events emitted by [Beanstalk](https://etherscan.io/address/0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5).**

### Subgraphs

All currently used subgraphs live on the graph protocol's centralized host.

- [Testing Subgraph](https://graph.node.bean.money/subgraphs/name/beanstalk-testing)
  - Used during local development for debugging and rapid iteration.
- [Dev Subgraph](https://graph.node.bean.money/subgraphs/name/beanstalk-dev)
  - Used for testing fixes or improvements made in the testing subgraph.
- [Canonical Subgraph](https://thegraph.com/explorer/subgraphs/R9rnzRuiyDybfDsZfoM7eA9w8WuHtZKbroGrgWwDw1d?view=Overview)
  - Decentralized deployment to the Graph network.
  - Stable deployment and current source of truth for UI and other production processes.
  - The `master` branch is updated when a new deployment is ready to be indexed.
  - All changes pushed to the canonical subgraph are prototyped on the testing subgraph, tested on the dev subgraph, then made canonical once verified.

### Testing

To test with Docker, the first time you will need to run `yarn run graph test -d`. This will build the docker images. Then, you can use the `yarn testd` script to run all tests. I have found running in docker to be preferred since otherwise there can be issues with console output and some test cases fail silently.

If you would like to run specific tests, you can do so by specifying the name of the test in all lowercase. When running in docker, add this flag to the start of the command `-e ARGS="<testname>"` right after `docker run`. You can find the full command inside `package.json` (be sure to remove the escape characters if running in the terminal).
