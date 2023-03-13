import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormikContext } from 'formik';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';

import { FormTxnsFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import { FormTxn, FormTxnBuilderPresets } from '~/util/FormTxns';
import useFarmerFormTxnSummary from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import FormTxnOptionCard from './FormTxnOptionCard';
import FormTxnOptionPill from './FormTxnOptionPill';

const getConfig = (key: keyof typeof FormTxnBuilderPresets) => {
  if (key === 'plant' || key === 'enroot') {
    return {
      variant: 'card',
      title: 'Add before this transaction',
    };
  }
  return {
    variant: 'pill',
    title: 'Add Claimable Assets to this transaction',
  };
};

const FormTxnsPrimaryOptions: React.FC<{}> = () => {
  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();

  /// Local State
  const [local, setLocal] = useState<Set<FormTxn>>(
    new Set(values.farmActions.primary || [])
  );
  const [open, show, hide] = useToggle();

  /// Helpers
  const { summary } = useFarmerFormTxnSummary();

  ///
  const formItems = useMemo(() => {
    const presetKey = values.farmActions.preset;
    const options = FormTxnBuilderPresets[presetKey].primary;
    const config = getConfig(presetKey);
    const someEnabled = options.find((opt) => summary[opt].enabled);

    return {
      ...config,
      options,
      noneEnabled: !someEnabled,
    };
  }, [summary, values.farmActions.preset]);

  /// Handlers
  const handleOnToggle = useCallback(
    (item: FormTxn) => {
      const copy = new Set([...local]);
      if (copy.has(item)) {
        copy.delete(item);
      } else {
        copy.add(item);
      }
      setLocal(copy);
      setFieldValue('farmActions.primary', Array.from(copy));
    },
    [setFieldValue, local]
  );

  /// Effects
  // initialize Form State & Reset the local state when the form resets
  useEffect(() => {
    if (!values.farmActions.primary) {
      setLocal(new Set());
      setFieldValue('farmActions.primary', []);
      hide();
    }
  }, [values.farmActions.primary, hide, setFieldValue]);

  if (formItems.noneEnabled || !formItems.options.length) return null;

  return (
    <SelectionAccordion<FormTxn>
      open={open}
      onChange={open ? hide : show}
      title={formItems.title}
      options={formItems.options}
      selected={local}
      onToggle={handleOnToggle}
      sx={{ borderRadius: 1 }}
      direction="row"
      render={(item, selected) => {
        const sharedProps = { option: item, summary: summary[item], selected };

        switch (formItems.variant) {
          case 'card': {
            return <FormTxnOptionCard {...sharedProps} />;
          }
          case 'pill': {
            return <FormTxnOptionPill {...sharedProps} />;
          }
          default:
            return null;
        }
      }}
    />
  );
};

export default FormTxnsPrimaryOptions;
