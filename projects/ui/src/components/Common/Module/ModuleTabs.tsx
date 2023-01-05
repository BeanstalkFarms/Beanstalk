import { Tabs, TabsProps } from '@mui/material';
import React from 'react';
import { ModuleHeader } from '~/components/Common/Module';
import { FC } from '~/types';

export const ModuleTabs : FC<TabsProps> = ({ children, sx, ...props }) => (
  <ModuleHeader>
    <Tabs 
      sx={{ 
        overflow: 'visible',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Tabs>
  </ModuleHeader>
);
