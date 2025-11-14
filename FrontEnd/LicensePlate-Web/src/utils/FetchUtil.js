// utils/FetchUtil.js
import { useAuth } from "../context/AuthContext";
export async function getData(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // พยายาม parse json แต่ถ้าไม่ใช่ json ก็คืน {} แทน
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await res.json();
    return {};
  } catch (err) {
    console.error('FetchUtil:getData error:', err);
    // คืนรูปแบบปลอดภัย ให้หน้าไม่ล้ม
    return { data: [] };
  }
}


export function useApiFetch() {
  const { token } = useAuth();
  return (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };
}