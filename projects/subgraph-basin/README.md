<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

## Beanstalk Wells Subgraph

[![Discord][discord-badge]][discord-url]

[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

### Subgraphs

- [Testing Subgraph](https://graph.bean.money/basin-testing)
  - The bleeding edge. Used for debugging and rapid iteration.
- [Dev Subgraph](https://graph.bean.money/basin-dev)
  - Used for testing fixes or improvements made in the testing subgraph before going live.
- [Canonical Subgraph](https://graph.bean.money/basin)
  - Stable deployment and current source of truth for UI and other production processes.

All subgraphs are hosted on a mix of Alchemy and Graph Network, with responses served from a proxy api managed by Beanstalk Farms. Read more about the advantages of the proxy here: https://github.com/BeanstalkFarms/Subgraph-Proxy.

Looking to analyze data from Basin on Ethereum? Append "\_eth" to each of the above links.

### Testing

To test with Docker, the first time you will need to run `yarn run graph test -d`. This will build the `matchstick` Docker image. Then, you can use the `yarn testd` script to run all tests. Alternatively, use `yarn testd-named <TestName1> ...` to run specific tests. I have found running in Docker to be preferred since otherwise there can be issues with console output and some test cases fail silently.

### Deploying

When using graph cli commands, you will often need to specify which manifest file should be used. This is necessary to support multiple chains in the same codebase. The commands which need it will be evident - as they will fail when unable to find a `subgraph.yaml` file. In those commands, include `./manifest/${chain}.yaml` as the final argument to the command. See scripts inside `package.json` for examples.
