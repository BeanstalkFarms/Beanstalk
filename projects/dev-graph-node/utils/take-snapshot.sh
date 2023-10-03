#! /bin/bash

docker stop docker-graph-node-1

docker exec docker-postgres-1 pg_dump -Ft graph-node -U graph-node | gzip -9 > graph-node-$(date +%d-%m-%y_%H-%M).tar.gz
tar czf ipfs-$(date +%d-%m-%y_%H-%M).tar.gz ./graph-node/docker/data/ipfs

docker start docker-graph-node-1
