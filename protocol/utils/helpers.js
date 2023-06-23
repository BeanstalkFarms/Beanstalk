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


exports.toBN = toBN
exports.advanceTime = advanceTime