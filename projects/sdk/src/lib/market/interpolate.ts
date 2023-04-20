import { BigNumber } from "ethers";
import { DecimalBigNumber as DBN } from "src/classes/DecimalBigNumber";

/**
 * @FIXME
 * - math.js uses https://github.com/MikeMcl/decimal.js/ (unknown size)
 * - ethers.js uses https://www.npmjs.com/package/bn.js (unknown size)
 *    - this is required because of ethers' dependency on https://www.npmjs.com/package/elliptic
 * - we use https://mikemcl.github.io/bignumber.js/ (8kb minfied and gzipped)
 *    - this supports decimals
 *
 * @QUESTIONS
 * - is Interpolate.fromPoints intended to accept decimals or only integers? (constraining
 *   to integers makes sense, we just may need to help provide some helper functions to do this)
 *
 * @TODO
 * - remove `math` dependency
 * - add some helper func for calculateShifts
 * - figure out what math.format is doing
 */

export function calcShifts(n: string, c: number) {
  let val = +n;
  if (Math.abs(val) == 0) {
    return 0;
  }
  while (val > 1) {
    val /= 10;
    c--;
  }
  if (val <= 0.1 && val > 0) {
    while (val <= 0.1) {
      val *= 10;
      c++;
    }
  }
  return c;
}

export function convertToRaisedInt(n: DBN, d: number): BigNumber {
  let r = n.abs().mul(new DBN("10").pow(d));
  return r.toBigNumber();
}

export class Interpolate {
  static exponentBase: number = 24;
  /**
   * @ref https://www.wikiwand.com/en/Monotone_cubic_interpolation
   * @param xs
   * @param ys
   * @returns
   */

  //FIXME: Implement using Ethers Bignumbers (elim. decimal usage)
  static fromPoints(
    xs: BigNumber[],
    ys: BigNumber[]
  ): { breakpoints: BigNumber[]; coefficients: BigNumber[]; exponents: number[]; signs: boolean[] } {
    var length = xs.length;
    if (length < 2) throw new Error(`Interpolate: must have >= 2 points`);
    if (ys.length != length) throw new Error(`Interpolate: dimensions of x and y must match`);
    let allYsAndXsPositive = true;
    allYsAndXsPositive = xs.every((x) => x.gte(0));
    if (!allYsAndXsPositive) throw new Error(`Negative x values are not allowed.`);
    allYsAndXsPositive = ys.every((x) => x.gte(0));
    if (!allYsAndXsPositive) throw new Error(`Negative y values are not allowed.`);

    const dys: Array<DBN> = [],
      dxs: Array<DBN> = [],
      ms: Array<DBN> = [];
    for (let i = 0; i < length - 1; i++) {
      const deltax = new DBN(xs[i + 1].sub(xs[i]).toString());
      const deltay = new DBN(ys[i + 1].sub(ys[i]).toString());

      dxs.push(deltax);
      dys.push(deltay);
      ms.push(deltay.div(deltax, this.exponentBase)); //store numerator and denominator
    }

    const c1s: Array<DBN> = [ms[0]];
    for (let i = 0; i < dxs.length - 1; i++) {
      if (ms[i].mul(ms[i + 1]).lt("0") || ms[i].mul(ms[i + 1]).eq("0")) {
        c1s.push(new DBN("0"));
      } else {
        const m_ = ms[i];
        const mNext = ms[i + 1];
        const dx_ = dxs[i];
        const dxNext = dxs[i + 1];
        const common = dx_.add(dxNext);
        const r = common
          .mul("3")
          .div(common.add(dxNext).div(m_, this.exponentBase).add(common.add(dx_).div(mNext, this.exponentBase)), this.exponentBase); //store numerator and denominator
        c1s.push(r);
      }
    }

    c1s.push(ms[ms.length - 1]);

    const c2s: Array<DBN> = [],
      c3s: Array<DBN> = [];

    for (let i = 0; i < c1s.length - 1; i++) {
      const c1 = c1s[i];
      const m_ = ms[i];
      const invDx = new DBN("1").div(dxs[i], this.exponentBase); //store numerator and denominator
      const common_ = c1.add(c1s[i + 1]).sub(m_.mul("2"));

      c2s.push(m_.sub(c1).sub(common_).mul(invDx));
      c3s.push(common_.mul(invDx).mul(invDx));
    }

    var breakpoints: Array<BigNumber> = new Array(length);
    var coefficients: Array<BigNumber> = new Array(length * 4);
    var exponents: Array<number> = new Array(length * 4);
    var signs: Array<boolean> = new Array(length * 4);

    for (let i = 0; i < length; i++) {
      signs[i * 4] = true;
      signs[i * 4 + 1] = c1s[i].isPositive();

      exponents[i * 4] = calcShifts(ys[i].toString(), this.exponentBase);
      exponents[i * 4 + 1] = calcShifts(c1s[i].toString(), this.exponentBase);

      coefficients[i * 4] = convertToRaisedInt(new DBN(ys[i].toString()), exponents[i * 4]);
      coefficients[i * 4 + 1] = convertToRaisedInt(c1s[i], exponents[i * 4 + 1]);

      breakpoints[i] = xs[i];

      if (i < dxs.length) {
        signs[i * 4 + 2] = c2s[i].isPositive();
        signs[i * 4 + 3] = c3s[i].isPositive();

        exponents[i * 4 + 2] = calcShifts(c2s[i].toString(), this.exponentBase);
        exponents[i * 4 + 3] = calcShifts(c3s[i].toString(), this.exponentBase);

        coefficients[i * 4 + 2] = convertToRaisedInt(c2s[i], exponents[i * 4 + 2]);
        coefficients[i * 4 + 3] = convertToRaisedInt(c3s[i], exponents[i * 4 + 3]);
      } else {
        signs[i * 4 + 2] = false;
        signs[i * 4 + 3] = false;
        exponents[i * 4 + 2] = 0;
        exponents[i * 4 + 3] = 0;
        coefficients[i * 4 + 2] = BigNumber.from("0");
        coefficients[i * 4 + 3] = BigNumber.from("0");
      }
    }

    return { breakpoints, coefficients, exponents, signs };
  }
}
