const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");
const { BigNumber } = require("ethers");

function parseGlobals(inputFilePath, outputFilePath, smartContractStalk, smartContractRoots) {
  const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

  // Sort silo tokens alphabetically
  const sortedSiloTokens = Object.keys(
    data.silo?.balances || { "0x0000000000000000000000000000000000000000": {} }
  ).sort();

  // Create an object of sorted balances
  const sortedBalances = sortedSiloTokens.reduce((acc, token) => {
    acc[token] = data.silo?.balances[token] || { deposited: "0", depositedBdv: "0" };
    return acc;
  }, {});

  const result = [
    // SystemInternalBalances
    [
      Object.keys(
        data.internalTokenBalanceTotal || { "0x0000000000000000000000000000000000000000": "0" }
      ),
      Object.values(
        data.internalTokenBalanceTotal || { "0x0000000000000000000000000000000000000000": "0" }
      ).map(convertToBigNum)
    ],
    // Fertilizer
    [
      Object.keys(data.fert?.fertilizer || {}).map(convertToBigNum),
      Object.values(data.fert?.fertilizer || {}).map(convertToBigNum),
      data.fert?.activeFertilizer ? convertToBigNum(data.fert.activeFertilizer) : "0",
      data.fert?.fertilizedIndex ? convertToBigNum(data.fert.fertilizedIndex) : "0",
      data.fert?.unfertilizedIndex ? convertToBigNum(data.fert.unfertilizedIndex) : "0",
      data.fert?.fertilizedPaidIndex ? convertToBigNum(data.fert.fertilizedPaidIndex) : "0",
      data.fert?.fertFirst ? convertToBigNum(data.fert.fertFirst) : "0",
      data.fert?.fertLast ? convertToBigNum(data.fert.fertLast) : "0",
      data.fert?.bpf ? convertToBigNum(data.fert.bpf) : "0",
      data.fert?.recapitalized ? convertToBigNum(data.fert.recapitalized) : "0",
      data.fert?.leftoverBeans ? convertToBigNum(data.fert.leftoverBeans) : "0"
    ],
    // Silo
    [
      // subtract stalk and roots from smart contract accounts from globals, until they have migrated
      data.silo?.stalk ? BigNumber.from(data.silo.stalk).sub(smartContractStalk).toString() : "0",
      data.silo?.roots ? BigNumber.from(data.silo.roots).sub(smartContractRoots).toString() : "0",
      data.silo?.earnedBeans ? convertToBigNum(data.silo.earnedBeans) : "0",
      data.orderLockedBeans ? convertToBigNum(data.orderLockedBeans) : "0",
      // all silo tokens
      sortedSiloTokens,
      // all silo balances (now sorted to match tokens)
      Object.values(sortedBalances).map((balance) => [
        convertToBigNum(balance.deposited),
        convertToBigNum(balance.depositedBdv)
      ]),
      // unripeSettings
      Object.entries(
        data.silo?.unripeSettings || {
          "0x0000000000000000000000000000000000000000": {
            underlyingToken: "0x0000000000000000000000000000000000000000",
            balanceOfUnderlying: "0"
          }
        }
      ).map(([token, settings]) => [
        settings.underlyingToken, // Extract the underlying token
        settings.balanceOfUnderlying ? convertToBigNum(settings.balanceOfUnderlying) : "0" // Extract and convert balanceOfUnderlying
      ]),
      Object.entries(data.silo?.germinating?.["0"] || {}).map(([_, { amount, bdv }]) => [
        convertToBigNum(amount),
        convertToBigNum(bdv)
      ]),
      Object.entries(data.silo?.germinating?.["1"] || {}).map(([_, { amount, bdv }]) => [
        convertToBigNum(amount),
        convertToBigNum(bdv)
      ]),
      data.silo?.unclaimedGerminating?.seasons || ["0"],
      Array.isArray(data.silo?.unclaimedGerminating)
        ? data.silo.unclaimedGerminating.map((germ) => [
            convertToBigNum(germ.stalk),
            convertToBigNum(germ.roots)
          ])
        : [["0", "0"]]
    ],
    // Field
    [
      data.fields?.["0"]?.pods ? convertToBigNum(data.fields["0"].pods) : "0",
      data.fields?.["0"]?.harvested ? convertToBigNum(data.fields["0"].harvested) : "0",
      data.fields?.["0"]?.harvestable ? convertToBigNum(data.fields["0"].harvestable) : "0",
      Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
    ],
    // Season
    [
      data.season?.current ? convertToBigNum(data.season.current) : "0",
      data.season?.lastSop ? convertToBigNum(data.season.lastSop) : "0",
      data.season?.lastSopSeason ? convertToBigNum(data.season.lastSopSeason) : "0",
      data.season?.rainStart ? convertToBigNum(data.season.rainStart) : "0",
      !!data.season?.raining,
      !!data.season?.fertilizing,
      data.season?.sunriseBlock ? convertToBigNum(data.season.sunriseBlock) : "0",
      !!data.season?.abovePeg,
      data.season?.stemStartSeason ? convertToBigNum(data.season.stemStartSeason) : "0",
      data.season?.stemScaleSeason ? convertToBigNum(data.season.stemScaleSeason) : "0",
      data.season?.start ? convertToBigNum(data.season.start) : "0",
      data.season?.period ? convertToBigNum(data.season.period) : "3600",
      data.season?.timestamp ? convertToBigNum(data.season.timestamp) : "0",
      Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
    ],
    // Weather
    [
      data.weather?.lastDeltaSoil ? convertToBigNum(data.weather.lastDeltaSoil) : "0",
      data.weather?.lastSowTime ? convertToBigNum(data.weather.lastSowTime) : "0",
      data.weather?.thisSowTime ? convertToBigNum(data.weather.thisSowTime) : "0",
      data.weather?.temp ? convertToBigNum(data.weather.temp) : "0",
      Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
    ],
    // SeedGauge
    [
      data.seedGauge?.averageGrownStalkPerBdvPerSeason
        ? convertToBigNum(data.seedGauge.averageGrownStalkPerBdvPerSeason)
        : "0",
      data.seedGauge?.beanToMaxLpGpPerBdvRatio
        ? convertToBigNum(data.seedGauge.beanToMaxLpGpPerBdvRatio)
        : "0",
      Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
    ],
    // Rain
    [
      data.rain?.pods ? convertToBigNum(data.rain.pods) : "0",
      data.rain?.roots ? convertToBigNum(data.rain.roots) : "0",
      Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
    ],
    // Evaluation Parameters
    [
      "100000000000000000000",
      "50000000000000000000",
      "4320",
      "50000000000000000",
      "150000000000000000",
      "250000000000000000",
      "950000000000000000",
      "1050000000000000000",
      "800000000000000000",
      "40000000000000000",
      "12000000000000000",
      "1050000",
      "500000000000000000",
      "1500000000000000000",
      "1000000"
    ],
    // ShipmentRoute
    data.shipmentRoutes.length
      ? data.shipmentRoutes.map((route) => [
          "0x555555987d98079b9f43CDcDBD52DbB24FfEEef5", // l2 shipment planner
          route.planSelector || "0x00000000",
          route.recipient ? convertToBigNum(route.recipient) : "0",
          route.data || "0x"
        ])
      : [["0x0000000000000000000000000000000000000000", "0x00000000", "0", "0x"]]
  ];

  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log("Globals JSON has been written successfully");
}

exports.parseGlobals = parseGlobals;
