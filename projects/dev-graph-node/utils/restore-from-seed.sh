#!/bin/bash
cd ./graph-node/docker
rm -rf ./data
docker compose create

cd ../../seed
tar -Pxzvf ipfs-snapshot.tar.gz
docker start docker-ipfs-1

docker start docker-postgres-1
read -t 10 -p "Letting postgres start up ..."
docker start docker-graph-node-1
read -t 5 -p  "Letting graph-node set up the databse..."
docker stop docker-graph-node-1

gzip -d graph-node-snapshot.tar.gz
docker exec docker-postgres-1 pg_restore -c -U graph-node -d graph-node -v /var/lib/seed/graph-node-snapshot.tar

docker start docker-graph-node-1
