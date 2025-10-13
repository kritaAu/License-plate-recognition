import { useEffect, useState } from 'react';
import Navbar from './navbar';
import Filters from './components/Filters';
import StatsCards from './components/StatsCards';
import LineChart from './components/LineChart';
import BarChart from './components/BarChart';
import RecordsTable from './components/RecordsTable';
import { getRecentEvents } from './services/dashboardApi';
import { formatThaiDateTime } from './utils/date';

export default function App() {
  const [filters, setFilters] = useState({
    start: '2025-08-01',
    end: '2025-08-09',
    direction: 'all',
    query: '',
  });

  const [stats, setStats] = useState({ total: 0, in: 0, out: 0, unknown: 0 });
  const [records, setRecords] = useState([]);

  const [lineData] = useState([]);
  const [barData] = useState([]);

  useEffect(() => {
    loadRecent();

  }, []);

  const loadRecent = async () => {
    const res = await getRecentEvents(); // เรียก /dashboard/recent
    const list = Array.isArray(res) ? res : res?.data || [];

    const mapped = list.map((e) => {
      const dir = (e.direction || '').toLowerCase();
      const status = dir === 'in' ? 'เข้า' : dir === 'out' ? 'ออก' : (e.direction || '-');
      const check = (e.role || '').toLowerCase() === 'staff' ? 'บุคคลภายใน' : 'บุคคลภายนอก';

      return {
        time: formatThaiDateTime(e.datetime),
        plate: `${e.plate || '-'}${e.province ? ' จ.' + e.province : ''}`,
        status,
        check,
        imgUrl: e.image || null,
        _raw: e,
      };
    });

    const total = mapped.length;
    const inCount = list.filter((x) => (x.direction || '').toLowerCase() === 'in').length;
    const outCount = list.filter((x) => (x.direction || '').toLowerCase() === 'out').length;
    const unknownCount = list.filter((x) => !x.plate || x.plate === '-').length;

    setRecords(mapped);
    setStats({ total, in: inCount, out: outCount, unknown: unknownCount });
  };

  const handleApplyFilters = () => {
    loadRecent();
  };

  const handleResetFilters = () => {
    setFilters({ start: '2025-08-01', end: '2025-08-09', direction: 'all', query: '' });
    loadRecent();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        <StatsCards stats={stats} />

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">สถิติรายเดือน</h3>
            <LineChart data={lineData} />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">สถิติรายวัน</h3>
            <BarChart data={barData} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">รายการล่าสุด</h3>
            <span className="text-sm text-gray-500">Items {records.length} items</span>
          </div>
          <RecordsTable records={records} />
        </div>
      </div>
    </div>
  );
}
