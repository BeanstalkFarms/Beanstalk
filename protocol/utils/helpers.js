function toBN(a) {
return ethers.BigNumber.from(a)
}

async function printGasUsed(result) {
    receipt = await result.wait()
    console.log(`Gas Used: ${strDisplay(receipt.gasUsed)}`)
}

function addCommas(nStr) {
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

exports.toBN = toBN
exports.printGasUsed = printGasUsed
exports.addCommas = addCommas
exports.strDisplay = strDisplay