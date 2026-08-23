import React, { useState } from 'react';

import { RFF_ANNOUNCEMENT_URL } from '~/lib/Rff/runtime';
import RffLiquidityNotice from './RffLiquidityNotice';
import RffRequestDialog from './RffRequestDialog';

const RequestForFill: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <RffLiquidityNotice
        announcementUrl={RFF_ANNOUNCEMENT_URL}
        onRequest={() => setOpen(true)}
      />
      <RffRequestDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default RequestForFill;
