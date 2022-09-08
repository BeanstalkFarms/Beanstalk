const fs = require('fs');

async function readPrune() {
    const contents = await fs.readFileSync('contracts/C.sol', 'utf-8');
    let num = contents.split('INITIAL_HAIRCUT = ')[1].split(';')[0]
    num = parseFloat(num).toLocaleString('fullwide', { useGrouping: false })
    return num
}

async function readEmaAlpha() {
    const contents = await fs.readFileSync('contracts/C.sol', 'utf-8');
    let num = contents.split('EMA_ALPHA = ')[1].split(';')[0]
    num = parseFloat(num).toLocaleString('fullwide', { useGrouping: false })
    return num
}

exports.readPrune = readPrune
exports.readEmaAlpha = readEmaAlpha