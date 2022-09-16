const { getPrice } = require("./contracts")

async function printPools() {
    const price = await getPrice()
    const p = await price.price()
    console.log("Beanstalk Pool statistics:")
    console.log('----------------------------')
    console.log('Totals')
    console.log(`Price: ${toFloatStr6(p.price)}`)
    console.log(`Liquidity: $${toFloatStr6(p.liquidity)}`)
    console.log(`Delta B: ${toFloatStr6(p.deltaB)}`)
    for (i in p.ps) {
        _printPool(p.ps[i])
    }
    console.log('----------------------------')
}

async function printPool(pool) {
    const price = await getPrice()
    const p = await price.price()
    for (i in p.ps) {
        if (pool == p.ps[i].pool) _printPool(p.ps[i])
    }
    console.log('----------------------------')
}

function _printPool(p) {
    console.log('----------------------------')
    console.log(`Pool: ${p.pool}`)
    console.log(`Balance of ${p.tokens[0]}: \n${p.balances[0]}`)
    console.log(`Balance of ${p.tokens[1]}: \n${p.balances[1]}`)
    console.log(`Price: ${toFloatStr6(p.price)}`)
    console.log(`Liquidity: $${toFloatStr6(p.liquidity)}`)
    console.log(`Delta B: ${toFloatStr6(p.deltaB)}`)
}


function toFloatStr6(x) {
    return strDisplay(parseFloat(x)/1e6)
}


function addCommas (nStr) {
    nStr += ''
    const x = nStr.split('.')
    let x1 = x[0]
    const x2 = x.length > 1 ? '.' + x[1] : ''
    var rgx = /(\d+)(\d{3})/
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2')
    }
    return x1 + x2
  }
  
  function strDisplay(str) {
    return addCommas(str.toString())
  }

exports.printPools = printPools
exports.printPool = printPool