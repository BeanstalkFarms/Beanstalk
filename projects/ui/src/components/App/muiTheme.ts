import { deepmerge } from '@mui/utils';
import {
  createTheme,
  lighten,
  responsiveFontSizes,
  ThemeOptions,
} from '@mui/material/styles';
import React from 'react';

// --------------------------------------------------

declare module '@mui/material/styles' {
  interface Palette {
    light: Palette['primary'];
    dark: Palette['primary'];
    cancel: Palette['primary'];
    inverse: Palette['primary'];
    naked: Palette['primary'];
  }
  interface PaletteOptions {
    light: PaletteOptions['primary'];
    dark: PaletteOptions['primary'];
    cancel: PaletteOptions['primary'];
    inverse: PaletteOptions['primary'];
    naked: PaletteOptions['primary'];
  }
  interface TypographyVariants {
    bodySmall: React.CSSProperties;
    bodyMedium: React.CSSProperties;
    bodyLarge: React.CSSProperties;
    headerSmall: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    bodySmall?: React.CSSProperties;
    bodyMedium?: React.CSSProperties;
    bodyLarge?: React.CSSProperties;
    headerSmall?: React.CSSProperties;
  }

  interface TypeText {
    tertiary?: string;
    light?: string;
  }
}

// Update the Button's color prop options
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    light: true;
    dark: true;
    cancel: true;
    inverse: true;
    naked: true;
  }
  interface ButtonPropsVariantOverrides {
    'outlined-secondary': true
  }
}
declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    light: true;
    dark: true;
    cancel: true;
    inverse: true;
    naked: true;
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    bodySmall: true;
    bodyMedium: true;
    bodyLarge: true;
    headerSmall: true;
  }
}

declare module '@mui/material/Tooltip' {
  interface TooltipProps {
    variant?: 'wide';
  }
}

// --------------------------------------------------

const BASE_FONT_SIZE = 16;
const remBase = (n: number) => `${(n / BASE_FONT_SIZE).toFixed(4)}rem`;

export const hexToRgba = (hex: string, alpha?: number) => {
  const stripped = hex.replace('#', '').split('');
  if (stripped.length % 3 !== 0 || stripped.length > 6) {
    throw new Error(`unexpected invalid hex value: ${hex}`);
  }

  const isCondensedHex = stripped.length === 3;
  const hexArr = stripped
    .reduce((prev, curr) => {
      if (isCondensedHex) {
        prev += curr;
      }
      prev += curr;
      return prev;
    }, '' as string)
    .toString();

  const r = parseInt(hexArr.slice(0, 2), 16);
  const g = parseInt(hexArr.slice(2, 4), 16);
  const b = parseInt(hexArr.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha ?? 1})`;
};

/**
 * Beanstalk's primary color pallete.
 *
 * Does NOT yet account for prior variance for theming.
 * See `constants/colors.ts`.
 */
export const BeanstalkPalette = {
  // Greens
  logoGreen: '#46B955',
  mediumGreen: lighten('#46B955', 0.7),
  lightGreen: '#E1F8E6',
  supportGreen: '#19873B',
  lightestGreen: '#EDF8EE',

  winterGreen: '#1D8A79',

  // Blues
  blue: '#C1DEF2',
  textBlue: '#122540',
  lightBlue: '#DAEBF7',
  lightestBlue: '#F6FAFE',
  darkBlue: '#1F78B4',
  nightBlue: '#162B49',
  skyBlue: '#DBEDFD',
  // Other
  grey: '#657265',
  realGrey: '#808080',
  lightGrey: '#9E9E9E',
  lightestGrey: '#DDDDDD',
  white: '#fff',
  offWhite: '#FCFCFC',
  black: '#333',
  // Reds
  // #FBE6E0
  washedRed: '#c35f42',
  mediumRed: lighten('#c35f42', 0.55),
  hoverRed: '#fef9f8',
  trueRed: '#AE2D20',
  lightestRed: '#FBEAEB',
  // Yellow
  yellow: '#f0df6a',
  lightYellow: '#FDF4E7',
  warningYellow: '#F2A64A',
  // Brown
  brown: 'rgba(121,87,57,1)',
  lightBrown: 'rgba(121,87,57,0.2)',
  darkBrown: 'rgba(88, 59, 35, 1)',

  // ---
  theme: {
    fall: {
      extraLight: '#FFFCED',
      light: '#FBE39D',
      primary: '#FFDE7B',
      brown: '#B97D46',
      lightBrown: '#E5D7C8',
    },
    winter: {
      primary: '#1D8A79',
      primaryHover: hexToRgba('#1D8A79', 0.05),
      iceBlue: '#A0C6E2',
      divider: '#002855',
      blueLight: '#1E6091',
      red: '#DA2C38',
      error: '#E33D51',
      orderGreen: '#60D394',
      listingRed: '#EC4067',
      primaryDark: '#0074AF',
      chart: {
        primaryLight: '#D1E7E4',
        blue: '#6B9AC4',
        blueLight: '#D0D7DD',
        purple: '#4059AD',
        purpleLight: '#AAB3D2',
        yellow: '#F4B942',
        yellowLight: '#FBE3B3',
        green: '#97D8C4',
        greenLight: '#D0DFDB',
      },
    },
  },
};

export const PAGE_BORDER_COLOR = BeanstalkPalette.blue;

export const IconSize = {
  xs: 14,
  small: 20,
  medium: 25,
  large: 50,
  tokenSelect: 44,
};

export const FontSize = {
  '3xl': '2rem', // 2*16 = 32px
  '2xl': '1.5rem', // 1.5*16 = 24px,
  '1xl': '1.25rem', // 1.25*16 = 20px,
  lg: '1.125rem', // 1.125*16 = 18px,
  base: '1rem', // 1*16 = 16px,
  sm: '0.875rem', // 0.875*16 = 14px,
  xs: '0.75rem', // 0.75*16 = 12px
};

export const FontWeight = {
  normal: 400,
  medium: 450,
  semiBold: 600,
  bold: 700,
};

export const XXLWidth = 1400;

// FIXME: changes to createTheme don't hot reload.
const muiThemeBase: ThemeOptions = {
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 800,
      lg: 1200,
      xl: 1536,
    },
  },

  /**
   *
   */
  spacing: 10,

  /**
   *
   */
  shape: {
    borderRadius: 10,
  },

  /**
   * https://mui.com/material-ui/customization/palette/
   */
  palette: {
    divider: BeanstalkPalette.blue,
    primary: {
      main: BeanstalkPalette.theme.winter.primary,
      dark: '#146054',
      light: BeanstalkPalette.theme.winter.primaryHover,
      contrastText: '#ffffff',
    },
    secondary: {
      main: BeanstalkPalette.blue,
      contrastText: '#ffffff',
    },
    light: {
      main: BeanstalkPalette.white,
      contrastText: BeanstalkPalette.textBlue,
    },
    inverse: {
      main: BeanstalkPalette.white,
      contrastText: BeanstalkPalette.logoGreen,
    },
    dark: {
      main: BeanstalkPalette.black,
      contrastText: BeanstalkPalette.white,
    },
    cancel: {
      main: BeanstalkPalette.washedRed,
      contrastText: '#ffffff',
    },
    naked: {
      main: 'transparent',
      contrastText: BeanstalkPalette.black,
    },
    //
    text: {
      primary: BeanstalkPalette.textBlue,
      secondary: BeanstalkPalette.grey,
      tertiary: BeanstalkPalette.lightGrey,
      light: BeanstalkPalette.lightestGrey
    },
    background: {
      default: BeanstalkPalette.theme.winter.iceBlue,
      paper: BeanstalkPalette.offWhite,
    }
  },

  /**
   *
   */
  typography: {
    fontFamily: 'Futura PT',
    fontSize: 16,

    // FONT WEIGHTS
    fontWeightLight: FontWeight.normal,
    fontWeightRegular: FontWeight.medium,
    fontWeightMedium: FontWeight.semiBold,
    fontWeightBold: FontWeight.bold,

    // page headers
    h1: {
      fontSize: FontSize['3xl'], // 32px
      fontWeight: FontWeight.bold,
    },
    // silo deposit graph
    h2: {
      fontSize: FontSize['2xl'], // 24px
      fontWeight: FontWeight.bold,
    },
    // nav button text
    h3: {
      fontSize: FontSize['1xl'], // 20px
      fontWeight: FontWeight.semiBold,
    },
    // component headers / tabs
    h4: {
      fontSize: FontSize.base, // 16px
      fontWeight: FontWeight.semiBold,
      lineHeight: '1.25rem', // 20px
    },
    // ---
    body1: {
      fontSize: FontSize.base, // 16px
      fontWeight: FontWeight.normal,
      lineHeight: '1.25rem',
    },
    // all module body text
    bodySmall: {
      fontFamily: 'Futura PT',
      fontSize: FontSize.sm, // 14px
      fontWeight: FontWeight.medium,
    },
    caption: {
      fontSize: FontSize.xs, // 12px
      lineHeight: '0.938rem', // 15px
      fontWeight: FontWeight.normal,
    },
    // nav labels, nav button labels, token labels (module)
    bodyMedium: {
      fontFamily: 'Futura PT',
      fontSize: FontSize['1xl'], // 20px
      fontWeight: FontWeight.medium,
      lineHeight: '1.875rem',
    },
    // token inputs (module)
    bodyLarge: {
      fontFamily: 'Futura PT',
      fontSize: FontSize['2xl'], // 24px
      fontWeight: FontWeight.medium,
      lineHeight: '1.875rem', // 30px
    },
    // smaller, bold headers & text
    headerSmall: {
      fontFamily: 'Futura PT',
      fontSize: FontSize.sm, // 14px
      fontWeight: FontWeight.bold,
    },
    // page subtitles
    subtitle1: {
      fontSize: FontSize.lg, // 18px
      fontWeight: FontWeight.normal,
    },
    button: {
      fontSize: remBase(0.75 * 20),
    },
  },

  // --------------------------------------------

  /**
   *
   */
  components: {
    MuiCard: {
      defaultProps: {
        elevation: 0,
        variant: 'outlined',
        color: 'secondary',
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          border: 'none'

        }),
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          borderColor: 'divider',
          borderWidth: 0.5,
        }),
      },
    },
    MuiButton: {
      variants: [
        {
          props: {
            variant: 'outlined',
            color: 'dark',
          },
          style: {
            borderColor: 'rgba(0, 0, 0, 0.26)',
          },
        },
        {
          props: {
            variant: 'outlined',
            color: 'light',
          },
          style: (t) => t.theme.unstable_sx({
            borderColor: BeanstalkPalette.lightestGrey,
            ':hover': {
              borderColor: 'primary.main',
              background: BeanstalkPalette.theme.winter.primaryHover
            }
          })
        },
        {
          props: {
            variant: 'contained',
            color: 'primary',
          },
          style: {
            '&.Mui-disabled': {
              backgroundColor: BeanstalkPalette.lightestGrey,
              color: BeanstalkPalette.lightGrey,
            },
          },
        },
        {
          props: {
            variant: 'outlined-secondary',
            color: 'secondary',
          },
          style: (t) => t.theme.unstable_sx({
            border: '1px solid',
            color: 'text.primary',
            borderColor: 'divider',
            ':hover': {
              borderColor: 'primary.main',
              background: BeanstalkPalette.theme.winter.primaryHover
            }
          })
        }
      ],
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
        disableRipple: true,
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          textTransform: 'none',
          // fontWeight: 'bold',
          '&.MuiButton-root:hover': {
            // backgroundColor: BeanstalkPalette.supportGreen,
          },
          '&.MuiLoadingButton-root:hover': {
            // backgroundColor: BeanstalkPalette.supportGreen,
          },
          fontWeight: 700,
          fontSize: '1rem',
          lineHeight: '1.25rem',
        }),
        /// Sizes
        sizeSmall: (t) => t.theme.unstable_sx({}),
        sizeMedium: (t) => t.theme.unstable_sx({
          py: 1,
          px: 1,
          height: '45px',
        }),
        sizeLarge: (t) => t.theme.unstable_sx({
          py: 1.5,
          px: 1.5,
          height: '60px',
        }),
        disabled: (t) => t.theme.unstable_sx({
          pointerEvents: 'auto',
        }),
        startIcon: (t) => t.theme.unstable_sx({
          marginLeft: 0, // prevent adornment from pulling close to right margin
        }),
        endIcon: (t) => t.theme.unstable_sx({
          marginRight: 0, // prevent adornment from pulling close to right margin
        }),
      },
    },
    MuiAlert: {
      variants: [
        {
          props: {
            color: 'warning',
          },
          style: (t) => t.theme.unstable_sx({
            backgroundColor: 'rgba(253, 244, 231, 0.3)',
            color: 'text.primary',
          }),
        },
      ],
      defaultProps: {},
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          px: 1,
          alignItems: 'center',
          '& .MuiAlert-icon': {
            m: 0,
            p: 0,
          },
        }),
        message: (t) => t.theme.unstable_sx({
          ml: 0.5,
        }),
      },
    },
    MuiTooltip: {
      defaultProps: {
        enterTouchDelay: 0,
        leaveTouchDelay: 1000000,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      variants: [
        {
          props: {
            variant: 'wide',
          },
          style: {},
        },
      ],
      styleOverrides: {
        tooltip: (t) => t.theme.unstable_sx({
          typography: 'body1',
          borderColor: 'divider',
          borderWidth: 1,
          borderStyle: 'solid',
          backgroundColor: BeanstalkPalette.lightestBlue,
          color: 'text.primary',
          p: 1,
          px: 1.25,
          transition: 'box-shadow none 300ms',
        }),
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({}),
      },
      variants: [
        {
          props: {
            variant: 'outlined',
          },
          style: {
            background: 'background.paper',
            borderColor: 'divider',
          },
        },
      ],
    },
    MuiAccordionSummary: {
      styleOverrides: {
        // FIXME: trying to disable the increase
        // in margin on AccordionSummary during expansion.
        // None of these work...
        root: (t) => t.theme.unstable_sx({
          minHeight: '0 !important',
          my: 0,
          px: 1,
        }),
        expanded: (t) => t.theme.unstable_sx({
          minHeight: '0 !important',
          m: [0, 0],
        }),
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          pt: 0,
          pb: 1,
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        color: 'secondary',
      },
      styleOverrides: {
        root: {},
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '1.5rem',
          borderRadius: '10px',
        },
        sizeSmall: {
          fontSize: '1.1rem',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          borderRadius: 1,
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          borderRadius: 1,
          px: 1,
          py: 1,
          border: '0.5px solid',
          borderColor: BeanstalkPalette.white,
        }),
      },
    },
    MuiList: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({}),
      },
    },
    MuiListItemText: {
      styleOverrides: {
        root: {},
      },
    },
    MuiTabs: {
      defaultProps: {
        variant: 'scrollable',
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          fontWeight: 'normal',
          mr: { xs: 2, md: 0 },
          minHeight: 0,
        }),
        indicator: {
          display: 'none',
        },
      },
    },
    MuiTab: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          p: 0,
          minHeight: 0,
          mr: 2,
          textAlign: 'left',
          minWidth: 0,
          fontWeight: 700,
          fontSize: '1rem', // 1*16 = 16px
          textTransform: 'none',
          color: 'text.tertiary',
          '&:active': {},
          '&:hover': {
            color: 'text.primary',
            labelIcon: {
              color: 'text.primary',
            },
          },
          '&.Mui-selected': {
            fontWeight: 700,
            fontSize: '1rem', // 1*16 = 16px
            color: 'text.primary',
          },
        }),
      },
    },
    MuiButtonGroup: {
      defaultProps: {
        variant: 'text',
        size: 'small',
      },
      styleOverrides: {
        root: {
          // Hide border dividers
          '&:not(:last-child)': {
            borderColor: 'transparent !important',
            border: 'none',
          },
          '&.MuiTab-iconWrapper': {
            color: BeanstalkPalette.black,
            mr: 0,
          },
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'transparent',
      },
    },
    MuiDialog: {
      defaultProps: {
        transitionDuration: 0,
        PaperProps: {
          sx: {
            background: BeanstalkPalette.white,
            minWidth: { xs: '95%', sm: '400px' },
          },
        },
      },
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({}),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          px: 1,
        }),
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          paddingTop: {
            md: 4,
            xs: 2,
          },
          paddingBottom: {
            md: 4,
            xs: 2,
          },
        }),
      },
    },
    MuiChip: {
      variants: [
        {
          props: {
            variant: 'filled',
            color: 'primary',
          },
          style: (t) => t.theme.unstable_sx({
            color: BeanstalkPalette.theme.winter.primary,
            backgroundColor: hexToRgba(BeanstalkPalette.theme.winter.primary, 0.1),

          }),
        },
        {
          props: {
            variant: 'filled',
            color: 'secondary',
          },
          style: (t) => t.theme.unstable_sx({
            color: BeanstalkPalette.textBlue,
            backgroundColor: BeanstalkPalette.lightestBlue,
          }),
        },
      ],
      styleOverrides: {
        root: (t) => t.theme.unstable_sx({
          fontWeight: 'normal',
          borderRadius: 1,
        }),
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          animationDuration: '0.8s',
        },
        circleIndeterminate: (t) => t.theme.unstable_sx({
          animation: 'none',
          strokeDasharray: '80px, 200px',
          strokeDashoffset: '0px',
        }),
      },
    }
  },
};

let muiTheme = createTheme({ ...muiThemeBase });

muiTheme = responsiveFontSizes(muiTheme);

export default muiTheme;

export const muiThemeCondensed = createTheme(
  deepmerge(muiThemeBase, { spacing: 8 })
);
