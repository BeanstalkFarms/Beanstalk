import { useSelector } from 'react-redux';
import { AppState } from '~/state';

export default function useMigrationNeeded() {
  return useSelector<AppState, boolean | undefined>(
    (state) => state._farmer.silo.migrationNeeded
  );
}
