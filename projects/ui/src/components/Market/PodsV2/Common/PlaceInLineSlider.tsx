import { Stack, Slider, Typography, SliderThumb } from '@mui/material';
import BigNumber from 'bignumber.js';
import { useAtom } from 'jotai';
import React from 'react';
import { useSelector } from 'react-redux';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';
import { ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import { displayBN } from '~/util';
import { placeInLineAtom } from '../info/atom-context';

const sliderSx = (canSlide?: boolean) => ({
  color: 'primary.main',
  height: '8px',
  boxShadow: 'none',
  '& .MuiSlider-thumb': {
    width: canSlide ? '1px' : '10px',
    height: canSlide ? '8px' : '10px',
    color: canSlide ? 'transparent' : 'primary.main',
    boxShadow: 'none',
    '& .triangle': {
      position: 'relative',
      bottom: '-10px',
      left: canSlide ? '1px' : '0px',
      width: '10px',
      height: '8px',
      borderStyle: 'solid',
      borderWidth: '0 5px 8px 5px',
      borderColor: 'transparent transparent #000000 transparent',
    },
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: 'inherit',
    },
  },
  '& .MuiSlider-track': {
    height: '8px',
    color: canSlide ? 'primary.main' : BeanstalkPalette.lightYellow,
  },
  '& .MuiSlider-rail': {
    color: BeanstalkPalette.lightYellow,
    opacity: 1,
    height: '8px',
    borderRadius: '2px',
  },
});

interface CustomThumbComponentProps extends React.HTMLAttributes<unknown> {}
function CustomThumbComponent(props: CustomThumbComponentProps) {
  const { children, ...other } = props;
  return (
    <SliderThumb {...other}>
      {children}
      <span className="triangle" />
    </SliderThumb>
  );
}

const PlaceInLineSlider: React.FC<{
  disabled?: boolean;
  canSlide?: boolean;
  isRange?: boolean;
}> = ({ disabled, canSlide = true, isRange = true }) => {
  // state
  const [index, setIndex] = useAtom(placeInLineAtom);
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>(
    (state) => state._beanstalk.field
  );

  const fieldMaxIndex = beanstalkField?.podLine || ZERO_BN;

  return (
    <Stack>
      <Slider
        color="primary"
        aria-label="place-in-line"
        value={index?.toNumber() || ZERO_BN.toNumber()}
        onChange={(_, v) => {
          canSlide && setIndex(new BigNumber(v as number));
        }}
        min={0}
        max={fieldMaxIndex.toNumber()}
        sx={{
          ...sliderSx(canSlide),
          cursor: canSlide && !disabled ? 'pointer' : 'default',
        }}
        components={{ Thumb: CustomThumbComponent }}
      />
      <Row width="100%">
        <Typography color="text.tertiary" variant="caption">
          0
        </Typography>
        <Typography width="100%" textAlign="center" variant="caption">
          Place in Line: 0 -{' '}
          <Typography component="span" color="text.tertiary" variant="caption">
            {displayBN(index || ZERO_BN)}
          </Typography>
        </Typography>
        <Typography color="text.tertiary" variant="caption">
          {displayBN(fieldMaxIndex)}
        </Typography>
      </Row>
    </Stack>
  );
};

export default PlaceInLineSlider;
