#!/usr/bin/env sh

bs_root=$PROJECT_CWD
ui_root=$bs_root/projects/ui

cd $ui_root

COMMIT_HASH=$(git rev-parse HEAD)
export VITE_NAME=$npm_package_name 
export VITE_VERSION=$COMMIT_HASH
export VITE_HOST='fleek' 
export VITE_GIT_COMMIT_REF=$COMMIT_HASH

echo "VITE_NAME=$VITE_NAME"
echo "VITE_VERSION=$VITE_VERSION"

yarn build
