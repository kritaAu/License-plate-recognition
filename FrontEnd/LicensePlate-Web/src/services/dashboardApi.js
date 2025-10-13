import { getData } from '../utils/FetchUtil';

const BASE = 'http://127.0.0.1:8000';

export async function getRecentEvents(limit = 10) {
  // สามารถต่อพารามิเตอร์ได้: `${BASE}/dashboard/recent?limit=${limit}`
  return await getData(`${BASE}/dashboard/recent`);
}
