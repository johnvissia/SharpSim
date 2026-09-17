"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-2xl", className)}
      classNames={{
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        month_caption: "flex justify-between items-center px-1 py-1 relative font-bold text-sm",
        caption_label: "text-sm font-bold text-white",
        nav: "flex items-center space-x-1",
        button_previous: "h-7 w-7 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition-colors border border-slate-700",
        button_next: "h-7 w-7 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition-colors border border-slate-700",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex w-full justify-between mb-2 border-b border-slate-800/80 pb-2",
        weekday: "text-slate-500 rounded-md w-9 font-bold text-[0.75rem] text-center uppercase tracking-wider",
        weeks: "space-y-1",
        week: "flex w-full justify-between mt-1",
        day: "h-9 w-9 text-center text-xs p-0 font-bold rounded-lg transition-all flex items-center justify-center hover:bg-slate-800 text-slate-300 cursor-pointer",
        range_start: "bg-indigo-600 text-white rounded-l-lg font-black shadow-md shadow-indigo-900/50",
        range_end: "bg-indigo-600 text-white rounded-r-lg font-black shadow-md shadow-indigo-900/50",
        range_middle: "bg-indigo-500/20 text-indigo-300 rounded-none font-bold",
        selected: "bg-indigo-600 text-white font-black hover:bg-indigo-500 focus:bg-indigo-600",
        today: "border border-indigo-500/60 text-indigo-400 font-black",
        outside: "text-slate-600 opacity-40 hover:opacity-70",
        disabled: "text-slate-600 opacity-30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }: any) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4 text-slate-300", className)} {...props} />;
          }
          return <ChevronRight className={cn("h-4 w-4 text-slate-300", className)} {...props} />;
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
