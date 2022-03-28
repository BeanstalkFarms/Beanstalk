var fs = require('fs');


const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const LUSD_3_CURVE = "0x1a70DfA7d2262988064A2D051dd47521E43c9BdD"

async function curve() {
    let threeCurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/Mock3Curve.sol/Mock3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      THREE_CURVE,
      JSON.parse(threeCurveJson).deployedBytecode,
    ]);

    let meta3CurveJson = fs.readFileSync(`./artifacts/contracts/mocks/curve/MockMeta3Curve.sol/MockMeta3Curve.json`);
    await network.provider.send("hardhat_setCode", [
      BEAN_3_CURVE,
      JSON.parse(meta3CurveJson).deployedBytecode,
    ]);

    await network.provider.send("hardhat_setCode", [
      LUSD_3_CURVE,
      JSON.parse(meta3CurveJson).deployedBytecode,
    ]);
}

exports.impersonateCurve = curve