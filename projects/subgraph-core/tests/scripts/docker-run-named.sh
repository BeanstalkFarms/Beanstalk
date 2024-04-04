#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: yarn testd-named <TestName1> [<TestName2> ...]"
    echo "Tests are assumed to be directly in the tests folder. Do not include .test.ts in this parameter."
    exit 1
fi

DOCKER_ARGS=""

# Loop through the provided test names
for TEST_NAME in "$@"; do
    
    TEST_NAME="$TEST_NAME"
    TEST_NAME_LOWER=$(echo "$TEST_NAME" | tr '[:upper:]' '[:lower:]')

    # Compile assembly script to wasm. This can be done inside docker but is more performant
    # if done prior as we can omit the optimize flag.
    $(pwd)/../../node_modules/assemblyscript/bin/asc \
        $(pwd)/tests/${TEST_NAME}.test.ts \
        $(pwd)/../../node_modules/@graphprotocol/graph-ts/global/global.ts \
        --lib $(pwd)/../../node_modules \
        --explicitStart \
        --outFile $(pwd)/tests/.bin/${TEST_NAME_LOWER}.wasm \
        --exportTable \
        --runtime stub \
        --debug

    if [ $? -ne 0 ]; then
        echo "Compilation failed for test $TEST_NAME. Aborting."
        exit 1
    fi

    DOCKER_ARGS+=" $TEST_NAME_LOWER"
done

# Run in docker on the matchstick image
docker run -e ARGS="$DOCKER_ARGS" -it --rm \
    --mount type=bind,source=$(pwd)/matchstick-docker.yaml,target=/matchstick/matchstick.yaml \
    --mount type=bind,source=$(pwd)/../../,target=/matchstick/repo-mounted/ \
    matchstick