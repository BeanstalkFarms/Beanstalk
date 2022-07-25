module.exports = {
    skipFiles: [
      './mocks/', 
      './farm/init/',
      './price/',
      './libraries/LibSafeMath32.sol',
      './libraries/LibSafeMath128.sol',
      './libraries/Decimal.sol',
      './libraries/LibDiamond.sol',
      './facets/DiamondLoupeFacet.sol',
      './libraries/Convert/LibPlainCurveConvert.sol',
      './libraries/Curve/LibBeanLUSDCurve.sol'
    ]
  };