var h = Object.defineProperty;
var a = (s, t, e) => t in s ? h(s, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : s[t] = e;
var i = (s, t, e) => (a(s, typeof t != "symbol" ? t + "" : t, e), e);
function c(s) {
  return Math.floor(s * 0.5);
}
function _(s, t, e = 1, o) {
  const n = Math.round(t * s), r = o ? e : Math.round(e * t), l = c(r);
  return { position: n - l, length: r };
}
class u {
  constructor(t, e) {
    i(this, "_x", null);
    i(this, "_options");
    this._x = t, this._options = e;
  }
  draw(t) {
    t.useBitmapCoordinateSpace((e) => {
      if (this._x === null)
        return;
      const o = e.context, n = _(
        this._x,
        e.horizontalPixelRatio,
        this._options.width
      );
      o.fillStyle = this._options.color, o.fillRect(
        n.position,
        0,
        n.length,
        e.bitmapSize.height
      );
    });
  }
}
class p {
  constructor(t, e) {
    i(this, "_source");
    i(this, "_x", null);
    i(this, "_options");
    this._source = t, this._options = e;
  }
  update() {
    const t = this._source._chart.timeScale();
    this._x = t.timeToCoordinate(this._source._time);
  }
  renderer() {
    return new u(this._x, this._options);
  }
}
class x {
  constructor(t, e) {
    i(this, "_source");
    i(this, "_x", null);
    i(this, "_options");
    this._source = t, this._options = e;
  }
  update() {
    const t = this._source._chart.timeScale();
    this._x = t.timeToCoordinate(this._source._time);
  }
  visible() {
    return this._options.showLabel;
  }
  tickVisible() {
    return this._options.showLabel;
  }
  coordinate() {
    return this._x ?? 0;
  }
  text() {
    return this._options.labelText;
  }
  textColor() {
    return this._options.labelTextColor;
  }
  backColor() {
    return this._options.labelBackgroundColor;
  }
}
const w = {
  color: "green",
  labelText: "",
  width: 3,
  labelBackgroundColor: "green",
  labelTextColor: "white",
  showLabel: !1
};
class d {
  constructor(t, e, o, n) {
    i(this, "_chart");
    i(this, "_series");
    i(this, "_time");
    i(this, "_paneViews");
    i(this, "_timeAxisViews");
    const r = {
      ...w,
      ...n
    };
    this._chart = t, this._series = e, this._time = o, this._paneViews = [new p(this, r)], this._timeAxisViews = [new x(this, r)];
  }
  updateAllViews() {
    this._paneViews.forEach((t) => t.update()), this._timeAxisViews.forEach((t) => t.update());
  }
  timeAxisViews() {
    return this._timeAxisViews;
  }
  paneViews() {
    return this._paneViews;
  }
}
export {
  d as VertLine
};
