import React, { useMemo } from 'react';
import { Typography, TypographyProps } from '@mui/material';
import { FarmFromMode, FarmToMode } from '~/lib/Beanstalk/Farm';
import copy from '~/constants/copy';
import AddressIcon from '../AddressIcon';
import PillSelectField, { PillSelectFieldProps } from './PillSelectField';
import { IconSize } from '../../App/muiTheme';

import { FC } from '~/types';

const FarmModeField : FC<
  Partial<PillSelectFieldProps>
  & {
    name : string;
    circDesc? : string;
    farmDesc? : string;
    baseMode? : (typeof FarmFromMode | typeof FarmToMode);
    labelProps?: TypographyProps;
  }
> = ({
  circDesc: _circDesc,
  farmDesc: _farmDesc,
  label: _label,
  baseMode = FarmToMode,  
  ...props
}) => {
  let circDesc : string;
  let farmDesc : string;
  let label    : string;
  if (baseMode === FarmToMode) {
    circDesc = _circDesc || 'Send assets to your wallet.';
    farmDesc = _farmDesc || 'Send assets to your internal balance within Beanstalk.';
    label    = _label    || 'Destination';
  } else {
    circDesc = _circDesc || 'Use assets from your wallet.';
    farmDesc = _farmDesc || 'Use assets to your internal balance within Beanstalk.';
    label    = _label    || 'Source';
  }

  const options = useMemo(() => ([
    {
      title: copy.MODES[baseMode.EXTERNAL],
      description: circDesc,
      pill: (
        <>
          <AddressIcon size={IconSize.xs} />
          <Typography variant="body1">
            {copy.MODES[baseMode.EXTERNAL]}
          </Typography>
        </>
      ),
      icon: <AddressIcon size={IconSize.small} width={IconSize.small} height={IconSize.small} />,
      value: baseMode.EXTERNAL,
    },
    {
      title: copy.MODES[baseMode.INTERNAL],
      description: farmDesc,
      pill: (
        <Typography variant="body1">
          🚜 {copy.MODES[baseMode.INTERNAL]}
        </Typography>
      ),
      icon: '🚜',
      value: baseMode.INTERNAL,
    },
    ...(props.options || [])
  ]), [baseMode.EXTERNAL, baseMode.INTERNAL, circDesc, farmDesc, props.options]);
  return (
    <PillSelectField
      label={label}
      {...props}          //
      options={options}   // always deterministically set options
    />
  );
};

export default FarmModeField;
