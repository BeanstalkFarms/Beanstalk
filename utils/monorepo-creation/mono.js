const fs = require('fs')
const root = `${__dirname}/Beanstalk`

main().catch((e) => {
  console.log("FAILED:");
  console.log(e);
});

async function main() {
  console.log(root);

  const rootf = root + "/package.json"
  rootj = require(rootf)
  rootj.workspaces.push('protocol')
  delete rootj.scripts.postinstall
  rootj.scripts["protocol:compile"]="yarn workspace protocol compile"
  rootj.scripts["ui:start"]="yarn workspace ui start"
  rootj.scripts["ui:build"]="yarn workspace ui build"
  rootj.scripts["ui:generate"]="yarn workspace ui generate"
  rootj.scripts["ui:test"]="yarn workspace ui test"

  fs.writeFileSync(rootf, JSON.stringify(rootj, null, 2)+'\n')


  const uif = root + "/projects/ui/package.json"
  uij = require(uif)
  uij.name = "ui"
  delete uij.scripts.postinstall
  fs.writeFileSync(uif, JSON.stringify(uij, null, 2)+'\n')

  const protocolf = root + "/protocol/package.json"
  protocolj = require(protocolf)
  protocolj.name = "protocol"
  fs.writeFileSync(protocolf, JSON.stringify(protocolj, null, 2)+'\n')


  const sgbsf = root + "/projects/subgraph-beanstalk/package.json"
  sgbsj = require(sgbsf)
  sgbsj.name = "subgraph-beanstalk"
  sgbsj.private = true;
  fs.writeFileSync(sgbsf, JSON.stringify(sgbsj, null, 2)+'\n')

  const sgbf = root + "/projects/subgraph-bean/package.json"
  sgbj = require(sgbf)
  sgbj.name = "subgraph-bean"
  sgbj.private = true;
  fs.writeFileSync(sgbf, JSON.stringify(sgbj, null, 2)+'\n')
}
