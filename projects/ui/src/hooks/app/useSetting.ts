import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from '~/state';
import { Settings } from '~/state/app';
import { updateSetting } from '~/state/app/actions';

const useSetting = <T extends keyof Settings>(key: T) => {
  const dispatch = useDispatch();
  const value  = useSelector<AppState, AppState['app']['settings'][T]>((state) => state.app.settings[key]);
  const update = useCallback((_value: Settings[T]) => {
    dispatch(
      updateSetting({
        key,
        value: _value
      })
    );
  }, [dispatch, key]);
  return useMemo(() => [value, update] as const, [value, update]);
};

export default useSetting;
