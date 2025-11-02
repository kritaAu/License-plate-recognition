import { getData } from '../utils/FetchUtil';

const BASE = 'http://127.0.0.1:8000';

/**
 * filters: { plate, firstName, lastName, studentId }
 * page, pageSize: ถ้าจะทำ pagination
 */
export async function searchMembers(filters = {}, page = 1, pageSize = 20) {
  const params = new URLSearchParams();

  if (filters.plate) params.set('plate', filters.plate.trim());
  if (filters.firstName) params.set('first_name', filters.firstName.trim());
  if (filters.lastName) params.set('last_name', filters.lastName.trim());
  if (filters.studentId) params.set('student_id', filters.studentId.trim());
  params.set('page', page);
  params.set('page_size', pageSize);

  // เปลี่ยนเป็นพาธจริงของคุณ
  return await getData(`${BASE}/search/members?${params.toString()}`);
}
