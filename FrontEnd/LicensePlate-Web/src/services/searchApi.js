import { getData } from '../utils/FetchUtil';

const BASE = 'http://127.0.0.1:8000';

/**
 * filters: { plate, firstName, lastName, studentId }
 * page, pageSize: ถ้าจะทำ pagination
 */
export async function searchMembers(filters = {}, page = 1, limit = 20) {
  try {
    const queryParams = new URLSearchParams();

    // (option) ถ้าอยากเพิ่ม filter ทีหลัง ก็ทำตรงนี้ได้ เช่น
    // if (filters.plate) queryParams.append("plate", filters.plate);

    const res = await fetch(`http://localhost:8000/members`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ searchMembers error:", err);
    return [];
  }
}

