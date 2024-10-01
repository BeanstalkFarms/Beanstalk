const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

// map from LP token to non-bean token
const nonBeanTokenMapping = {
  "0xBEA0005B8599265D41256905A9B3073D397812E4": "0xBEA0005B8599265D41256905A9B3073D397812E4",
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543": "0x1BEA054dddBca12889e07B3E076f511Bf1d27543",
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788": "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788",
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F": "0x5979D7b546E38E414F7E9822514be443A4800529",
  "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c": "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
  "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "0xbEA00fF437ca7E8354B174339643B4d1814bED33": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
};

const tokenToOracleMapping = {
  "0xBEA0005B8599265D41256905A9B3073D397812E4": [
    "0x0000000000000000000000000000000000000000",
    "0x00000000",
    "0x00",
    "0x00"
  ],
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543": [
    "0x0000000000000000000000000000000000000000",
    "0x00000000",
    "0x00",
    "0x00"
  ],
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788": [
    "0x0000000000000000000000000000000000000000",
    "0x00000000",
    "0x00",
    "0x00"
  ],
  "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": [
    "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    "0x00000000",
    "0x01",
    "0x000000000000000000000000000000000000000000000000000000000001fa40"
  ],
  "0x5979D7b546E38E414F7E9822514be443A4800529": [
    "0xCCCCCC35b53c8a16404Ae414AFa31F30A5B35626",
    "0xb0dd7409",
    "0x00",
    "0x000000000000000000000000639fe6ab55c921f74e7fac1ee960c0b6293ba6120000000000000000000000000000000000000000000000000000000000003840000000000000000000000000e141425bc1594b8039de6390db1cdaf4397ea22b000000000000000000000000000000000000000000000000000000000001fa4000000000000000000000000035751007a407ca6feffe80b3cb397736d2cf4dbe"
  ],
  "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe": [
    "0xCCCCCC35b53c8a16404Ae414AFa31F30A5B35626",
    "0xb0dd7409",
    "0x00",
    "0x000000000000000000000000639fe6ab55c921f74e7fac1ee960c0b6293ba6120000000000000000000000000000000000000000000000000000000000003840000000000000000000000000b523ae262d20a936bc152e6023996e46fdc2a95d000000000000000000000000000000000000000000000000000000000001fa400000000000000000000000005979d7b546e38e414f7e9822514be443a4800529"
  ],
  "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": [
    "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57",
    "0x00000000",
    "0x01",
    "0x000000000000000000000000000000000000000000000000000000000001fa40"
  ],
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": [
    "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    "0x00000000",
    "0x01",
    "0x000000000000000000000000000000000000000000000000000000000001fa40"
  ],
  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": [
    "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",
    "0x00000000",
    "0x01",
    "0x000000000000000000000000000000000000000000000000000000000001fa40"
  ]
};

// 0x2c5fa218 is sig for "maxWeight(bytes memory)"
const liquidityWeightImpl = [
  "0x0000000000000000000000000000000000000000",
  "0x2c5fa218",
  "0x00",
  "0x00"
];
// 0xe4b8d822 is sig for ""function defaultGaugePointFunction(uint256 currentGaugePoints,uint256 optimalPercentDepositedBdv,uint256 percentOfDepositedBdv,bytes memory)""
const gaugePointImpl = ["0x0000000000000000000000000000000000000000", "0xe4b8d822", "0x00", "0x00"];

const tokensToWhitelist = [
  "0xBEA0005B8599265D41256905A9B3073D397812E4",
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543",
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788",
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce",
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F",
  "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c",
  "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c",
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7",
  "0xbEA00fF437ca7E8354B174339643B4d1814bED33"
];

const tokenToWhitelistMapping = {
  "0xBEA0005B8599265D41256905A9B3073D397812E4": [
    "0xBEA0005B8599265D41256905A9B3073D397812E4",
    true,
    false,
    false,
    false
  ],
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543": [
    "0x1BEA054dddBca12889e07B3E076f511Bf1d27543",
    true,
    false,
    false,
    false
  ],
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788": [
    "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788",
    true,
    false,
    false,
    false
  ],
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce": [
    "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce",
    true,
    true,
    true,
    true
  ],
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F": [
    "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F",
    true,
    true,
    true,
    true
  ],
  "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c": [
    "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c",
    true,
    true,
    true,
    true
  ],
  "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c": [
    "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c",
    true,
    true,
    true,
    true
  ],
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7": [
    "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7",
    true,
    true,
    true,
    true
  ],
  "0xbEA00fF437ca7E8354B174339643B4d1814bED33": [
    "0xbEA00fF437ca7E8354B174339643B4d1814bED33",
    true,
    true,
    true,
    true
  ]
};

const tokenToGpAndOptimalPercentDepositedBdvMapping = {
  "0xBEA0005B8599265D41256905A9B3073D397812E4": ["0", "0"],
  "0x1BEA054dddBca12889e07B3E076f511Bf1d27543": ["0", "0"],
  "0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788": ["0", "0"],
  "0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce": ["1000000000000000000000", "16000000"],
  "0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F": ["0", "26000000"],
  "0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c": ["1000000000000000000000", "14000000"],
  "0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c": ["1000000000000000000000", "20000000"],
  "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7": ["1000000000000000000000", "12000000"],
  "0xbEA00fF437ca7E8354B174339643B4d1814bED33": ["1000000000000000000000", "12000000"]
};

function parseWhitelist(inputFilePath, outputFilePath) {
  try {
    const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

    const defaultAssetSettings = {
      selector: "0xc84c7727",
      stalkEarnedPerSeason: "1",
      stalkIssuedPerBdv: "10000000000",
      milestoneSeason: data.season.current,
      milestoneStem: "0",
      encodeType: "0x01",
      deltaStalkEarnedPerSeason: "0",
      gaugePoints: "0",
      optimalPercentDepositedBdv: "0"
    };

    const assetSettings = data.silo.assetSettings;
    const output = {};

    for (const token of tokensToWhitelist) {
      var nonBeanToken = nonBeanTokenMapping[token];
      var tokenAssetSettings = defaultAssetSettings;
      if (token in assetSettings) {
        tokenAssetSettings = assetSettings[token];

        // 3crv was not a well and thus had an ecode type of 0x00
        // BEAN:USDC is now a well and thus has an encode type of 0x01
        // for more info see System.sol
        if (token === "0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7") {
          tokenAssetSettings.encodeType = "0x01";
        }
      }

      var tokenToGpAndOptimalPercentDepositedBdv =
        tokenToGpAndOptimalPercentDepositedBdvMapping[token];

      output[token] = [
        token,
        // non-bean token, this is used for Oracle settings
        nonBeanToken,
        // silo settings array
        // the gaugePoint and LiquidityWeight Selectors are now moved due
        // to the Implementation Update, and thus are set manually.
        [
          tokenAssetSettings.selector,
          tokenAssetSettings.stalkEarnedPerSeason,
          tokenAssetSettings.stalkIssuedPerBdv,
          tokenAssetSettings.milestoneSeason,
          tokenAssetSettings.milestoneStem,
          tokenAssetSettings.encodeType,
          tokenAssetSettings.deltaStalkEarnedPerSeason,
          tokenToGpAndOptimalPercentDepositedBdv[0],
          tokenToGpAndOptimalPercentDepositedBdv[1],
          gaugePointImpl,
          liquidityWeightImpl
        ],
        // whitelist status
        tokenToWhitelistMapping[token],
        // oracle implementation (for the non-bean token)
        tokenToOracleMapping[nonBeanToken]
      ];
    }

    // only order requirement is that unripe tokens should be first

    var finalOutput = [];

    // loop through output and put into finalOutput in order of tokensToWhitelist
    for (const token of tokensToWhitelist) {
      finalOutput.push(output[token]);
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(finalOutput, null, 2));
    console.log("Whitelist JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

exports.parseWhitelist = parseWhitelist;
