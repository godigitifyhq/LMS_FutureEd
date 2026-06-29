"use client";

type Props = {
  dateFrom: string;
  dateTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
};

export function CustomDateRange({ dateFrom, dateTo, onFromChange, onToChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col">
        <label className="text-[10px] text-gray-400 mb-0.5">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onFromChange(e.target.value)}
          title="From date"
          className="border border-surface-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-[10px] text-gray-400 mb-0.5">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onToChange(e.target.value)}
          title="To date"
          className="border border-surface-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
