import { hexToRgba } from "~/util/UI";
import { BeanstalkPalette } from "../App/muiTheme";

export const chartColors = [
    {
      lineColor: BeanstalkPalette.logoGreen,
      topColor: hexToRgba(BeanstalkPalette.logoGreen, 0.8),
      bottomColor: hexToRgba(BeanstalkPalette.logoGreen, 0.2),
    },
    {
      lineColor: BeanstalkPalette.darkBlue,
      topColor: hexToRgba(BeanstalkPalette.darkBlue, 0.8),
      bottomColor: hexToRgba(BeanstalkPalette.darkBlue, 0.2),
    },
    {
      lineColor: BeanstalkPalette.washedRed,
      topColor: hexToRgba(BeanstalkPalette.washedRed, 0.8),
      bottomColor: hexToRgba(BeanstalkPalette.washedRed, 0.2),
    },
    {
      lineColor: BeanstalkPalette.theme.spring.chart.yellow,
      topColor: hexToRgba(BeanstalkPalette.theme.spring.chart.yellow, 0.8),
      bottomColor: hexToRgba(BeanstalkPalette.theme.spring.chart.yellow, 0.2),
    },
    {
      lineColor: BeanstalkPalette.theme.winter.error,
      topColor: hexToRgba(BeanstalkPalette.theme.winter.error, 0.8),
      bottomColor: hexToRgba(BeanstalkPalette.theme.winter.error, 0.2),
    },
  ];