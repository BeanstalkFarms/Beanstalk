#! /bin/bash
# local graph node rewind to target block

BLOCK_NUMBER=18260000
BLOCK_HASH=0x6316091c92f898b6ab8c5235560e3477fc9221705aa0cc74e1e70bed737f95e9

docker stop docker-graph-node-1

docker exec docker-postgres-1 bash -c "echo 'set search_path to chain1;' >> /tmp/rewind.sql"
docker exec docker-postgres-1 bash -c "echo 'DELETE FROM blocks where number > ${BLOCK_NUMBER};' >> /tmp/rewind.sql"
docker exec docker-postgres-1 bash -c "echo 'DELETE FROM call_cache WHERE block_number > ${BLOCK_NUMBER};' >> /tmp/rewind.sql"
docker exec -t docker-postgres-1 psql graph-node graph-node -f /tmp/rewind.sql 
docker exec docker-postgres-1 bash -c "rm /tmp/rewind.sql"

docker start docker-graph-node-1

docker exec docker-graph-node-1 graphman --config /var/lib/config/config.toml rewind QmYL2mJmUqJTBUDSZWpyatxgHe9AuWaQFzHash4RA5jCZx --block-hash ${BLOCK_HASH} --block-number ${BLOCK_NUMBER} --force
docker exec docker-graph-node-1 graphman --config /var/lib/config/config.toml rewind QmPo8bcqdgvTks3ZzpFhHVudf2eahRhf56k6Jno76aoCPX --block-hash ${BLOCK_HASH} --block-number ${BLOCK_NUMBER} --force
docker exec docker-graph-node-1 graphman --config /var/lib/config/config.toml rewind QmcRJk2XJfwHScUV8YJqHnoJobsw6bCG958eNcewAEtKWZ --block-hash ${BLOCK_HASH} --block-number ${BLOCK_NUMBER} --force
