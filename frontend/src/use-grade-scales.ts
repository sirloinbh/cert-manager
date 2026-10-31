import { gradeScaleApi } from './grade-scale-data';
import { useLoad } from './use-load';

const loadScales = () => gradeScaleApi.list();

/** The server's grade scales. A page still works without them: forms fall back to what is saved. */
export function useGradeScales() {
  const loaded = useLoad('all', loadScales);
  return {
    scales: loaded.state === 'ok' ? loaded.data.scales : [],
    failed: loaded.state === 'error',
  };
}
