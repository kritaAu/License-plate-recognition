export default function RecordsTable({ records = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">เวลา</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ทะเบียน</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ทิศทาง</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">สถานะ</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ภาพ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-700">{record.time}</td>
              <td className="py-3 px-4 text-sm text-gray-700">{record.plate}</td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    record.status === 'เข้า'
                      ? 'bg-blue-100 text-blue-700'
                      : record.status === 'ออก'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {record.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    record.check === 'บุคคลภายใน'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {record.check}
                </span>
              </td>
              <td className="py-3 px-4">
                {record.imgUrl ? (
                  <img
                    src={record.imgUrl}
                    alt="snapshot"
                    className="w-16 h-12 object-cover rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                    ไม่มีภาพ
                  </div>
                )}
              </td>
            </tr>
          ))}

          {!records.length && (
            <tr>
              <td colSpan="5" className="py-6 text-center text-sm text-gray-500">
                ไม่มีข้อมูลรายการล่าสุด
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
