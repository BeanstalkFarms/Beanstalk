function toBN(a) {
  return ethers.BigNumber.from(a)
}

async function advanceTime(time) {
  let timestamp = (await ethers.provider.getBlock('latest')).timestamp;
  timestamp += time
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

async function changeNetwork(network, verbose = true) {
  await hre.switchNetwork(network);
  if (verbose) console.log(`Switched to ${network} network.`);
}


exports.toBN = toBN
exports.advanceTime = advanceTime
exports.changeNetwork = changeNetwork