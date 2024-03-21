import React, { useMemo } from 'react';
import { useFormikContext } from 'formik';
import useToggle from '~/hooks/display/useToggle';
import { FC } from '~/types';
import { TokenInputProps } from '~/components/Common/Form/TokenInputField';
import useAccount from '~/hooks/ledger/useAccount';
import { FertilizerBalance } from '~/state/farmer/barn';
import FertilizerSelectDialog from '~/components/Barn/FertilizerSelectDialog';
import { Button } from '@mui/material';

const FertInputField: FC<
  {
    /** A farmer's fertilizers */
    fertilizers: FertilizerBalance[];
  } & TokenInputProps
> = ({ fertilizers, ...props }) => {
  /// Form state
  const { values, setFieldValue } = useFormikContext<{
    /// These fields are required in the parent's Formik state
    fertilizerIds: any[];
    amounts: any[];
    totalSelected: number;
  }>();

  /// Local state
  const [dialogOpen, showDialog, hideDialog] = useToggle();

  /// Account
  const account = useAccount();

  useMemo(() => {
    setFieldValue('fertilizerIds', []);
    setFieldValue('amounts', []);
    setFieldValue('totalSelected', 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  return (
    <>
      <FertilizerSelectDialog
        fertilizers={fertilizers}
        handleClose={hideDialog}
        open={dialogOpen}
      />
      <Button 
        onClick={showDialog}
        variant='outlined-secondary'
        color='secondary'
        sx={{
          paddingY: 4,
          fontWeight: 'normal',
          color: 'text.primary',
        }}
      >
        Select Fertilizers to Transfer
      </Button>
    </>
  );
};

export default FertInputField;
