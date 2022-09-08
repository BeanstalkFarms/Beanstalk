const { toX } = require("./helpers");


function getEma(emaLast, balLast, deltaTs, a) {
    emaNow = emaLast
    
    const ONE = ethers.BigNumber.from(toX('1', 36))
    for (let i = 0; i < deltaTs; i++) {
        emaNow = ONE.sub(a).mul(balLast).add(a.mul(emaNow)).div(ONE);
    }
    return emaNow
}

exports.getEma = getEma