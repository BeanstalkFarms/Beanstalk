


async function increaseNonce(account, n = 1) {

    console.log(`Start Nonce: ${await ethers.provider.getTransactionCount(account.address)}`)

    await Promise.all([...Array(n).keys()].map(
        (n) => account.sendTransaction({
                    to: account.address,
                    value: ethers.utils.parseEther("0")
                })
    ))

    console.log(`End Nonce: ${await ethers.provider.getTransactionCount(account.address)}`)

}

exports.increaseNonce = increaseNonce