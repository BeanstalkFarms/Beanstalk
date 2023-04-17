git clone git@github.com:graphprotocol/graph-node.git
# https://github.com/graphprotocol/graph-node/tree/master/docker#running-graph-node-on-an-macbook-m1
docker rmi graphprotocol/graph-node:latest
cd graph-node && ./docker/build.sh
docker tag graph-node graphprotocol/graph-node:latest
