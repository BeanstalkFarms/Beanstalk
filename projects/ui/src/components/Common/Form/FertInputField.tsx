import React, { useCallback, useMemo } from 'react';
import { useFormikContext } from 'formik';
import useToggle from '~/hooks/display/useToggle';
import { SPROUTS } from '~/constants/tokens';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import { TokenInputProps } from '~/components/Common/Form/TokenInputField';
import useAccount from '~/hooks/ledger/useAccount';
import { FertilizerBalance } from '~/state/farmer/barn';
import FertilizerSelectDialog from '~/components/Barn/FertilizerSelectDialog';
import {
  TokenAdornment,
  TokenInputField,
} from '.';

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
  }>();

  /// Local state
  const [dialogOpen, showDialog, hideDialog] = useToggle();

  /// Account
  const account = useAccount();

  useMemo(() => {
    setFieldValue('fertilizerIds', []);
    setFieldValue('amounts', []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  /// Button to select a new fertilizer
  const InputProps = useMemo(
    () => ({
      endAdornment: (
         <TokenAdornment
            token={SPROUTS}
            onClick={showDialog}
            buttonLabel={
            <Row gap={0.75}>
              {!values.fertilizerIds || values.fertilizerIds.length === 0 ?
                  `Select Fertilizers`
                : values.fertilizerIds.length === 1 ?
                  `ID: 1234`
                : values.fertilizerIds.length > 1 &&
                  `${values.fertilizerIds.length} FERT${values.fertilizerIds.length > 1 && 'S'}`
              }
            </Row>
          }
          size={props.size}
        />
      ),
    }),
    [showDialog, values.fertilizerIds, props.size]
  );

  /// Handlers
  const handleFertSelect = useCallback(
    (selectedFertilizer: any) => {

      const newIds = [...values.fertilizerIds];
      const newAmounts = [...values.amounts];

      const indexOf = values.fertilizerIds.findIndex(
        (fertilizerId) => fertilizerId === selectedFertilizer.id
      );

      if (values.fertilizerIds.length === 0 || indexOf < 0) {
          newIds.push(selectedFertilizer.id);
          newAmounts.push(selectedFertilizer.amount);
      } else {
          newIds.splice(indexOf, 1);
          newAmounts.splice(indexOf, 1);
      };

      setFieldValue('fertilizerIds', newIds);
      setFieldValue('amounts', newAmounts);

    },
    [values.amounts, values.fertilizerIds, setFieldValue]
  );

  return (
    <>
      <FertilizerSelectDialog
        fertilizers={fertilizers}
        handleSelect={handleFertSelect}
        handleClose={hideDialog}
        selected={values.fertilizerIds}
        open={dialogOpen}
      />
      <TokenInputField
        name='test'
        fullWidth
        InputProps={InputProps}
        balance={values.fertilizerIds[0] ? values.fertilizerIds[0].amount : undefined}
        placeholder={values.amounts[0] ? values.amounts[0].toString() : undefined}
        disabled
        hideBalance
        {...props}
      />
    </>
  );
};

export default FertInputField;
