"use client";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TimelineHeader() {
  return (
    <div className="grid grid-cols-7 border-b border-[#e4e4e0] bg-white sticky top-0 z-10">
      {WEEKDAYS.map((day) => (
        <div
          key={day}
          className="border-r border-[#e4e4e0] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 last:border-r-0"
        >
          {day}
        </div>
      ))}
    </div>
  );
}
