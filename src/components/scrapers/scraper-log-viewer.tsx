"use client";

import { useState, useEffect, ChangeEvent } from "react";

interface ScraperLogViewerProps {
  scraperRunId: string;
}

interface LogEntry {
  timestamp: string; // ISO string
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}

const mockLogs: LogEntry[] = [
  {
    timestamp: new Date(Date.now() - 60000 * 5).toISOString(),
    level: "INFO",
    message: "Starting scraper run...",
  },
  {
    timestamp: new Date(Date.now() - 60000 * 4).toISOString(),
    level: "INFO",
    message: "Fetching product list page 1",
  },
  {
    timestamp: new Date(Date.now() - 60000 * 3).toISOString(),
    level: "WARN",
    message: "Slow response detected, retrying...",
  },
  {
    timestamp: new Date(Date.now() - 60000 * 2).toISOString(),
    level: "ERROR",
    message: "Failed to fetch product details: timeout",
  },
  {
    timestamp: new Date(Date.now() - 60000).toISOString(),
    level: "INFO",
    message: "Scraper run completed with errors",
  },
];

export default function ScraperLogViewer({ scraperRunId }: ScraperLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    // TODO: Replace with real API call when backend is ready
    const fetchLogs = async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      setLogs(mockLogs);
    };

    fetchLogs();
  }, [scraperRunId]);

  const handleLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setFilterLevel(e.target.value);
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === "ALL" || log.level === filterLevel;
    const matchesText = log.message.toLowerCase().includes(searchText.toLowerCase());
    return matchesLevel && matchesText;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "INFO":
        return "text-blue-600";
      case "WARN":
        return "text-yellow-600";
      case "ERROR":
        return "text-red-600";
      default:
        return "text-gray-800";
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
        <div>
          <label className="mr-2 font-medium">Filter by level:</label>
          <select
            value={filterLevel}
            onChange={handleLevelChange}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="ALL">All</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warning</option>
            <option value="ERROR">Error</option>
          </select>
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchText}
            onChange={handleSearchChange}
            className="w-full border border-gray-300 rounded px-2 py-1"
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded p-2 overflow-y-auto max-h-[60vh] font-mono text-sm border border-gray-200">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500">No logs found.</div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="mb-1">
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`${getLevelColor(log.level)} font-semibold mr-2`}>
                [{log.level}]
              </span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}