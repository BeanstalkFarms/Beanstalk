import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch, Tooltip, Typography, Stack } from '@mui/material';
import { useFormikContext } from 'formik';
import AddIcon from '@mui/icons-material/Add';
import BigNumber from 'bignumber.js';
import Row from '../Row';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';
import {
  ClaimPlantAction,
  ClaimPlantActionMap,
} from '~/hooks/beanstalk/useClaimAndPlantActions';
import useFarmerClaimPlantOptions from '~/hooks/farmer/useFarmerClaimAndPlantOptions';
import ClaimPlantOptionCard from '../Selection/ClaimPlantOptionCard';
import { ClaimAndPlantFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import useTimedRefresh from '~/hooks/app/useTimedRefresh';

type ClaimAndPlantGasResult = Partial<{
  [key in ClaimPlantAction]?: BigNumber;
}>;

const ClaimAndPlantAdditionalOptions: React.FC<{
  actions: ClaimPlantActionMap;
}> = ({ actions }) => {
  /// State
  const [hovered, setHovered] = useState<Set<ClaimPlantAction>>(new Set());
  const [local, setLocal] = useState<Set<ClaimPlantAction>>(new Set());
  const [gasEstimates, setGasEstimates] = useState<ClaimAndPlantGasResult>({});
  const [open, show, hide] = useToggle();

  /// Helpers
  const { options: claimPlantOptions } = useFarmerClaimPlantOptions();

  /// Formik
  const {
    values: { farmActions },
    setFieldValue,
  } = useFormikContext<ClaimAndPlantFormState>();

  const options = useMemo(() => {
    // the options are the complement of possible actions to values.options
    const _options = new Set(
      Object.keys(ClaimPlantAction) as ClaimPlantAction[]
    );
    farmActions.options.forEach((opt) => _options.delete(opt));
    return _options;
  }, [farmActions.options]);

  const [required, enabled, allToggled] = useMemo(() => {
    const _required = new Set(
      farmActions.additional.required?.filter(
        (opt) => claimPlantOptions[opt].enabled
      )
    );

    const _enabled = Array.from(options).filter(
      (opt) => claimPlantOptions[opt].enabled
    );

    const _allToggled = _enabled.every((action) => local.has(action));

    return [_required, _enabled, _allToggled];
  }, [farmActions.additional.required, options, claimPlantOptions, local]);

  /// Handlers
  const handleOnToggle = (item: ClaimPlantAction) => {
    const copy = new Set([...local]);
    const affected = [item, ...claimPlantOptions[item].implied];

    if (copy.has(item)) {
      affected.forEach((v) => {
        if (!required.has(v)) {
          copy.delete(v);
        }
      });
    } else {
      affected.forEach((v) => {
        enabled.includes(v) && copy.add(v);
      });
    }

    setLocal(copy);
    setFieldValue('farmActions.additional.selected', [...copy]);
  };

  const handleOnToggleAll = () => {
    const newSet = new Set([...(allToggled ? required : enabled)]);
    setLocal(newSet);
    setFieldValue('farmActions.additional.selected', newSet);
  };

  const estimateGas = useCallback(async () => {
    if (!options.size || !Object.keys(actions).length) return;

    const optionKeys = [...options];
    const estimates = await Promise.all(
      optionKeys.map((opt) => actions[opt]().txn.estimateGas())
    ).then((results) =>
      results.reduce<ClaimAndPlantGasResult>((prev, curr, i) => {
        prev[optionKeys[i]] = new BigNumber(curr.toString());
        return prev;
      }, {})
    );

    setGasEstimates(estimates);
  }, [actions, options]);

  useTimedRefresh(estimateGas, 2 * 1000, open);

  useEffect(() => {
    if (!required.size) return;
    const hasAllRequired = [...required].every((opt) => local.has(opt));
    if (!hasAllRequired) {
      const updatedSelected = new Set([...local, ...required]);
      setLocal(updatedSelected);
      setFieldValue('farmActions.additional.selected', [...updatedSelected]);
    }
  }, [local, required, setFieldValue]);

  const handleMouseEvent = useCallback((item: ClaimPlantAction, isRemoving: boolean) => {
    if (!claimPlantOptions[item].enabled) return;
    const copy = new Set([...hovered]);
    const affected = [item, ...claimPlantOptions[item].implied];
    if (isRemoving) {
      affected.forEach((option) => copy.delete(option));
    } else {
      affected.forEach(
        (option) => enabled.includes(option) && copy.add(option)
      );
    }
    setHovered(copy);
  }, [claimPlantOptions, enabled, hovered]);

  return (
    <SelectionAccordion<ClaimPlantAction>
      open={open}
      onChange={open ? hide : show}
      title={
        <Row gap={0.5}>
          <AddIcon fontSize="small" color="primary" />
          <Typography color="primary.main">
            Add additional transactions to save gas
          </Typography>
        </Row>
      }
      subtitle={
        <Row
          width="100%"
          justifyContent="space-between"
          // We add a negative margin b/c the MUI switch component has padding of 12px, and
          // removing the padding from the switch component causes unexpected behavior
          sx={{ my: '-12px' }}
        >
          <Typography color="text.secondary">Claim All</Typography>
          <Switch
            checked={allToggled}
            onClick={handleOnToggleAll}
            disabled={enabled.length <= 1}
          />
        </Row>
      }
      options={options}
      selected={local}
      onToggle={handleOnToggle}
      render={(item, selected) => {
        const option = claimPlantOptions[item];

        return (
          <Tooltip title={!option.enabled ? `Nothing to ${option.title}` : ''}>
            <Stack width="100%">
              <ClaimPlantOptionCard
                option={item}
                summary={option}
                selected={selected}
                required={required.has(item)}
                gas={gasEstimates[item] || undefined}
                isHovered={hovered.has(item)}
                onMouseOver={() => handleMouseEvent(item, false)}
                onMouseLeave={() => handleMouseEvent(item, true)}
              />
            </Stack>
          </Tooltip>
        );
      }}
    />
  );
};

export default ClaimAndPlantAdditionalOptions;
