import React from 'react';
import { Tab } from '@mui/material';
import useTabs from '~/hooks/display/useTabs';
import { Module, ModuleContent, ModuleTabs } from '~/components/Common/Module';
import Swap from '~/components/Swap/Actions/Swap';
import Transfer from '~/components/Swap/Actions/Transfer';

import { FC } from '~/types';

const SLUGS = ['swap', 'transfer'];

const SwapActions: FC<{}> = () => {
  const [tab, handleChange] = useTabs(SLUGS, 'action');

  return (
    <Module>
      <ModuleTabs value={tab} onChange={handleChange}>
        <Tab label="Swap" />
        <Tab label="Transfer" />
      </ModuleTabs>
      <ModuleContent>
        {tab === 0 ? <Swap /> : null}
        {tab === 1 ? <Transfer /> : null}
      </ModuleContent>
    </Module>
  );
};
export default SwapActions;
