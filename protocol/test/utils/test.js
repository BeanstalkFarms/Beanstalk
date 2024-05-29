function testIfRpcSet(a, b) {
  if (!!process.env.FORKING_RPC) {
    describe(a, b);
  } else {
    describe.skip(`${a} – Skipping (Set FORKING_RPC in .env file to run)`, b);
    // describe(a, function () {
    //     it('Skipping Test – Set FORKING_RPC in .env file to run.', async function () {})
    // })
  }
}

exports.testIfRpcSet = testIfRpcSet;
