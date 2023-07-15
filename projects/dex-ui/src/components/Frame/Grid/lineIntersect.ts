// @ts-nocheck
// Found here: https://gist.github.com/w8r/7b701519a7c5b4840bec4609ceab3171
// Algo to find where a line intersects a rectangle

/**
 * Liang-Barsky function by Daniel White
 *
 * @link http://www.skytopia.com/project/articles/compsci/clipping.html
 *
 * @param  {number}        x0
 * @param  {number}        y0
 * @param  {number}        x1
 * @param  {number}        y1
 * @param  {array<number>} bbox
 * @return {array<array<number>>|null}
 */
export function liangBarsky(x0, y0, x1, y1, bbox) {
  var [xmin, xmax, ymin, ymax] = bbox;
  var t0 = 0,
    t1 = 1;
  var dx = x1 - x0,
    dy = y1 - y0;
  var p, q, r;

  for (var edge = 0; edge < 4; edge++) {
    // Traverse through left, right, bottom, top edges.
    if (edge === 0) {
      p = -dx;
      q = -(xmin - x0);
    }
    if (edge === 1) {
      p = dx;
      q = xmax - x0;
    }
    if (edge === 2) {
      p = -dy;
      q = -(ymin - y0);
    }
    if (edge === 3) {
      p = dy;
      q = ymax - y0;
    }

    r = q / p;

    if (p === 0 && q < 0) return null; // Don't draw line at all. (parallel line outside)

    if (p < 0) {
      if (r > t1) return null; // Don't draw line at all.
      else if (r > t0) t0 = r; // Line is clipped!
    } else if (p > 0) {
      if (r < t0) return null; // Don't draw line at all.
      else if (r < t1) t1 = r; // Line is clipped!
    }
  }

  return [
    [x0 + t0 * dx, y0 + t0 * dy],
    [x0 + t1 * dx, y0 + t1 * dy]
  ];
}
