'use client';

interface DateFilterProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function DateFilter({ selectedDate, onDateChange }: DateFilterProps) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const quickFilters = [
    { label: 'All Dates', value: 'all' },
    { label: 'Today', value: formatDate(today) },
    { label: 'Tomorrow', value: formatDate(tomorrow) },
    { label: 'This Week', value: 'week' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Date</h3>
      <div className="space-y-2">
        {quickFilters.map((filter) => (
          <label key={filter.value} className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="date-filter"
              checked={selectedDate === filter.value}
              onChange={() => onDateChange(filter.value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {filter.label}
            </span>
          </label>
        ))}
        
        <div className="mt-3">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            Custom Date:
          </label>
          <input
            type="date"
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
    </div>
  );
}
