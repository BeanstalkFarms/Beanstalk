const BEANSTALK = "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5"
const fs = require('fs')

function create2Address(name, symbol, searchingFor, start = 0) {
    console.log(`Create2: ${name}, ${symbol}, ${searchingFor}, ${start}`)
    const format = `./artifacts/contracts/tokens/ERC20/BeanstalkERC20.sol/BeanstalkERC20.json`
    const threePoolJson = fs.readFileSync(format);
    const bytecode = JSON.parse(threePoolJson).bytecode

    const encoded = ethers.utils.defaultAbiCoder.encode([ "address", "string", "string" ], [ BEANSTALK, name, symbol ]);

    const yay = `${bytecode}${encoded.slice(2)}`
    for(let salt = start; salt <= 1000000000000; salt++) {
        const saltHex = ethers.utils.formatBytes32String(`${salt}`)
        const result = ethers.utils.getCreate2Address(BEANSTALK, saltHex, ethers.utils.keccak256(yay));
        if (salt % 1000000 == 0) console.log(salt)
        if (result.toString().substring(0, searchingFor.length) == searchingFor) {
            console.log(`${result},${saltHex},${salt}`)
        }
    }
}

exports.create2Address = create2Address
