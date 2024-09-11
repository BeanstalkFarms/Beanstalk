const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parseGlobals(inputFilePath, outputFilePath) {
  const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

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
      data.silo?.stalk ? convertToBigNum(data.silo.stalk) : "0",
      data.silo?.roots ? convertToBigNum(data.silo.roots) : "0",
      data.silo?.earnedBeans ? convertToBigNum(data.silo.earnedBeans) : "0",
      data.orderLockedBeans ? convertToBigNum(data.orderLockedBeans) : "0",
      Object.keys(data.silo?.balances || { "0x0000000000000000000000000000000000000000": {} }),
      Object.values(
        data.silo?.balances || {
          "0x0000000000000000000000000000000000000000": { deposited: "0", depositedBdv: "0" }
        }
      ).map((balance) => [
        convertToBigNum(balance.deposited),
        convertToBigNum(balance.depositedBdv)
      ]),
      Object.entries(
        data.silo?.unripeSettings || {
          "0x0000000000000000000000000000000000000000": { balanceOfUnderlying: "0" }
        }
      ).map(([token, settings]) => [
        token,
        settings.balanceOfUnderlying ? convertToBigNum(settings.balanceOfUnderlying) : "0"
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
      data.season?.withdrawSeasons ? convertToBigNum(data.season.withdrawSeasons) : "0",
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
    // seedGaugeSettings
    [
      data.seedGaugeSettings?.maxBeanMaxLpGpPerBdvRatio
        ? convertToBigNum(data.seedGaugeSettings.maxBeanMaxLpGpPerBdvRatio)
        : "0",
      data.seedGaugeSettings?.minBeanMaxLpGpPerBdvRatio
        ? convertToBigNum(data.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio)
        : "0",
      data.seedGaugeSettings?.targetSeasonsToCatchUp
        ? convertToBigNum(data.seedGaugeSettings.targetSeasonsToCatchUp)
        : "0",
      data.seedGaugeSettings?.podRateLowerBound
        ? convertToBigNum(data.seedGaugeSettings.podRateLowerBound)
        : "0",
      data.seedGaugeSettings?.podRateOptimal
        ? convertToBigNum(data.seedGaugeSettings.podRateOptimal)
        : "0",
      data.seedGaugeSettings?.podRateUpperBound
        ? convertToBigNum(data.seedGaugeSettings.podRateUpperBound)
        : "0",
      data.seedGaugeSettings?.deltaPodDemandLowerBound
        ? convertToBigNum(data.seedGaugeSettings.deltaPodDemandLowerBound)
        : "0",
      data.seedGaugeSettings?.deltaPodDemandUpperBound
        ? convertToBigNum(data.seedGaugeSettings.deltaPodDemandUpperBound)
        : "0",
      data.seedGaugeSettings?.lpToSupplyRatioUpperBound
        ? convertToBigNum(data.seedGaugeSettings.lpToSupplyRatioUpperBound)
        : "0",
      data.seedGaugeSettings?.lpToSupplyRatioOptimal
        ? convertToBigNum(data.seedGaugeSettings.lpToSupplyRatioOptimal)
        : "0",
      data.seedGaugeSettings?.lpToSupplyRatioLowerBound
        ? convertToBigNum(data.seedGaugeSettings.lpToSupplyRatioLowerBound)
        : "0",
      data.seedGaugeSettings?.excessivePriceThreshold
        ? convertToBigNum(data.seedGaugeSettings.excessivePriceThreshold)
        : "0",
      data.seedGaugeSettings?.soilCoefficientHigh
        ? convertToBigNum(data.seedGaugeSettings.soilCoefficientHigh)
        : "0",
      data.seedGaugeSettings?.baseReward
        ? convertToBigNum(data.seedGaugeSettings.baseReward)
        : "0",
      data.seedGaugeSettings?.excessivePriceThreshold
        ? convertToBigNum(data.seedGaugeSettings.excessivePriceThreshold)
        : "0"
    ],
    // ShipmentRoute
    data.shipmentRoutes.length
      ? data.shipmentRoutes.map((route) => [
          route.planContract || "0x0000000000000000000000000000000000000000",
          route.planSelector || "0x00000000",
          route.recipient ? convertToBigNum(route.recipient) : "0",
          route.data || "0x"
        ])
      : [["0x0000000000000000000000000000000000000000", "0x00000000", "0", "0x"]]
  ];

  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log("JSON has been written successfully");
}

exports.parseGlobals = parseGlobals;
