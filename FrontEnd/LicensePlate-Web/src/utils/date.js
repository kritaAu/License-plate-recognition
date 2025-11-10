export function formatThaiDateTime(isoString) {
  if (!isoString) return "-";
  
  try {
    const date = new Date(isoString);
    
    //ดึงค่า Components ทั้งหมดในรูปแบบ UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    // ประกอบร่างเป็น "dd/mm/yyyy HH:MM:SS" (ตามเวลา UTC)
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

  } catch (error) {
    console.error("Invalid date string:", isoString, error);
    return "Invalid Date";
  }
}