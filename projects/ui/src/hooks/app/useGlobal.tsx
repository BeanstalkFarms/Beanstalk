import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from '~/state';
import { Globals } from '~/state/app';
import { setGlobal } from '~/state/app/actions';

export default function useGlobal(key: keyof Globals) {
  const dispatch = useDispatch();
  const visible = useSelector<AppState, boolean>((state) => state.app.globals[key]);
  const update = useCallback((value: boolean) => dispatch(setGlobal({ key, value })), [dispatch, key]);
  return [
    visible,
    update,
  ] as const;
}
