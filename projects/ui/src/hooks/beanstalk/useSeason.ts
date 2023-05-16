import { useAppSelector } from '~/state';

export default function useSeason() {
  return useAppSelector((s) => s._beanstalk.sun.season.current);
}
