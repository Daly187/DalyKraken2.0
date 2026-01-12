/**
 * Date Navigator Component
 * Allows users to navigate between news dates
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';

interface DateNavigatorProps {
  selectedDate: string;
  availableDates: string[];
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export default function DateNavigator({
  selectedDate,
  availableDates,
  onDateChange,
  onRefresh,
  loading = false,
}: DateNavigatorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Get relative date label
  const getRelativeLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const todayDate = new Date();
    todayDate.setHours(12, 0, 0, 0);

    const diffTime = todayDate.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return null;
  };

  // Navigate to previous date
  const goToPrevious = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      onDateChange(availableDates[currentIndex + 1]);
    }
  };

  // Navigate to next date
  const goToNext = () => {
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      onDateChange(availableDates[currentIndex - 1]);
    }
  };

  // Go to today
  const goToToday = () => {
    onDateChange(today);
  };

  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrevious = currentIndex < availableDates.length - 1;
  const hasNext = currentIndex > 0;

  const relativeLabel = getRelativeLabel(selectedDate);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={goToPrevious}
          disabled={!hasPrevious || loading}
          className={`p-2 rounded-lg transition-colors ${
            hasPrevious && !loading
              ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Date display / picker toggle */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {formatDate(selectedDate)}
              </div>
              {relativeLabel && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {relativeLabel}
                </div>
              )}
            </div>
          </button>

          {/* Date picker dropdown */}
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50">
              <div className="p-2">
                {availableDates.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No news data available
                  </div>
                ) : (
                  availableDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => {
                        onDateChange(date);
                        setShowDatePicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        date === selectedDate
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-medium">{formatDate(date)}</div>
                      {getRelativeLabel(date) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {getRelativeLabel(date)}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={goToNext}
          disabled={!hasNext || loading}
          className={`p-2 rounded-lg transition-colors ${
            hasNext && !loading
              ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Today button */}
        {!isToday && (
          <button
            onClick={goToToday}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
          >
            Today
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          title="Refresh news"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
