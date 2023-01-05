import React from 'react';
import MuiMarkdown from 'mui-markdown';
import { BeanstalkPalette, FontSize, FontWeight } from '~/components/App/muiTheme';
import { FC } from '~/types';

const MarkdownWrapper: FC<{}> = ({ children }) => (
  <MuiMarkdown
    overrides={{
      ul: {
        component: 'ul',
        props: {
          style: {
            marginTop: '8px',
            marginBottom: '16px', // fixme: nested
          }
        }
      },
      li: {
        component: 'li',
        props: {
          style: {
            fontSize: FontSize.base,
            lineHeight: '1.33rem',
            marginBottom: '4px',
            wordBreak: 'normal'
          }
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      p: {
        component: 'p',
        props: {
          style: {
            // marginTop: '10px',
            marginTop: '4px',
            marginBottom: '8px',
            lineHeight: '1.33rem',
            fontSize: FontSize.base,
            wordBreak: 'normal'
          }
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      h1: {
        component: 'h1',
        props: {
          style: {
            fontFamily: 'Futura PT',
            fontSize: FontSize['2xl'], // 24px
            fontWeight: FontWeight.semiBold,
            wordBreak: 'normal'
          },
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      h2: {
        component: 'h2',
        props: {
          style: {
            marginTop: '24px',
            marginBottom: '12px',
            fontFamily: 'Futura PT',
            fontSize: FontSize['1xl'], // 20px
            fontWeight: FontWeight.semiBold,
            lineHeight: '2rem',
            wordBreak: 'normal',
            borderBottom: '1px solid #f8f8f8',
          },
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      h3: {
        component: 'h3',
        props: {
          style: {
            marginTop: '24px',
            marginBottom: '8px',
            fontSize: FontSize.lg,
            fontWeight: FontWeight.semiBold,
            wordBreak: 'normal'
          },
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      h4: {
        component: 'h4',
        props: {
          style: {
            marginBottom: '12px',
            fontSize: FontSize.base, // 16px
            fontWeight: FontWeight.semiBold,
            lineHeight: '1.25rem',
            wordBreak: 'normal'
          },
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      h5: {
        component: 'h5',
        props: {
          style: {
            marginBottom: '8px',
            fontSize: FontSize.sm, // 14px
            lineHeight: '1.15rem',
            fontWeight: FontWeight.semiBold,
            wordBreak: 'normal'
          }
        } as React.HTMLProps<HTMLParagraphElement>,
      },
      code: {
        props: {
          style: {
            backgroundColor: BeanstalkPalette.lightestGrey,
            borderRadius: 3,
            margin: 1,
            padding: 0.75,
            paddingRight: 5,
            paddingLeft: 5,
            fontSize: FontSize.sm
          }
        }
      },
      // table: {
      //   props: {
      //     style: {
      //       display: 'block',
      //       overflow: 'scroll',
      //       maxWidth: '100%',
      //     }
      //   }
      // },
      a: {
        props: {
          style: {
            wordBreak: 'break-word',
            color: BeanstalkPalette.theme.winter.primary,
          }
        }
      },
      img: {
        props: {
          style: {
            width: '100%'
          }
        }
      }
    }}
  >
    {children as any}
  </MuiMarkdown>
);

export default MarkdownWrapper;
