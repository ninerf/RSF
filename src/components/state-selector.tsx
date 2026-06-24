"use client";

import { US_STATES, type StateCode } from "@/lib/constants/us-states";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface Props {
  selected: StateCode[];
  onChange: (states: StateCode[]) => void;
  /** Map of state_code → "X days ago" for recently searched states */
  recentlySearched?: Record<string, string>;
}

export function StateSelector({ selected, onChange, recentlySearched }: Props) {
  const allSelected = selected.length === US_STATES.length;

  const toggle = (code: StateCode) => {
    onChange(
      selected.includes(code)
        ? selected.filter((s) => s !== code)
        : [...selected, code],
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selected.length} of {US_STATES.length} states selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange(allSelected ? [] : US_STATES.map((s) => s.code))
          }
        >
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>
      <div className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-3 lg:grid-cols-4">
        {US_STATES.map((s) => {
          const recent = recentlySearched?.[s.code];
          return (
            <label
              key={s.code}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-secondary"
            >
              <Checkbox
                checked={selected.includes(s.code)}
                onChange={() => toggle(s.code)}
              />
              <span>{s.name}</span>
              {recent && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {recent}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
