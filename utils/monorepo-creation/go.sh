#!/bin/zsh

root=$(pwd)

######Clone Repositories
git clone git@github.com:BeanstalkFarms/Beanstalk.git
git clone git@github.com:BeanstalkFarms/Beanstalk-SDK.git
git clone git@github.com:BeanstalkFarms/Beanstalk-UI.git
git clone git@github.com:BeanstalkFarms/Beanstalk-Subgraph.git
git clone git@github.com:BeanstalkFarms/Bean-Subgraph.git

##### Beanstalk
cd $root/Beanstalk
git checkout -b monorepo
cd $root

###### SDK
# This folder gets root-leve merged with /Beanstalk
cd $root/Beanstalk-SDK
rm -rf .git
rm -rf .husky
mv docs projects/sdk
echo >> $root/Beanstalk/.gitignore
echo >> $root/Beanstalk/.gitignore
echo "# From SDK Monorepo Join:" >> $root/Beanstalk/.gitignore
cat .gitignore >> $root/Beanstalk/.gitignore
rm .gitignore
rm README.md
cp -r . $root/Beanstalk

cd $root/Beanstalk
git add .
git commit -m "monorepo: merge with sdk"

###### UI
cd $root/Beanstalk-UI
rm -rf .git
rm -rf .yarn
rm .yarnrc.yml 
mkdir $root/Beanstalk/projects/ui
cp -r . $root/Beanstalk/projects/ui

cd $root/Beanstalk
git add .
git commit -m "monorepo: add ui"

###### Beanstalk-Subgraph
cd $root/Beanstalk-Subgraph
rm -rf .git
rm package-lock.json
mkdir $root/Beanstalk/projects/subgraph-beanstalk
cp -r . $root/Beanstalk/projects/subgraph-beanstalk
cd $root/Beanstalk
git add .
git commit -m "monorepo: add subgraph-beanstalk"

##### Bean-Subgraph
cd $root/Bean-Subgraph
rm -rf .git
rm package-lock.json
mkdir $root/Beanstalk/projects/subgraph-bean
cp -r . $root/Beanstalk/projects/subgraph-bean
cd $root/Beanstalk
git add .
git commit -m "monorepo: add subgraph-bean"

##### Post Ops
cd $root
# rm -rf Beanstalk-SDK
# rm -rf Beanstalk-UI
# rm -rf Beanstalk-Subgraph
# rm -rf Bean-Subgraph

# update package.json files as needed
node ./mono.js
cd $root/Beanstalk
git add .
git commit -m "monorepo: update projects' package.json"

# Make yarn work
rm $root/Beanstalk/protocol/yarn.lock
rm $root/Beanstalk/projects/subgraph-beanstalk/yarn.lock
rm $root/Beanstalk/projects/subgraph-bean/yarn.lock
rm $root/Beanstalk/projects/ui/yarn.lock
yarn && git add . && git commit -m "monorepo: update yarn"
 
# Add monorepo scripts for historic/audit purposes
mkdir -p $root/Beanstalk/utils/monorepo-creation
cp $root/go.sh $root/Beanstalk/utils/monorepo-creation
cp $root/reset.sh $root/Beanstalk/utils/monorepo-creation
cp $root/mono.js $root/Beanstalk/utils/monorepo-creation
git add . && git commit -m "monorepo: add utils"



