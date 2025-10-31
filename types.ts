
export interface ScheduleItem {
  startTime: string;
  endTime: string;
  title: string;
  category: string;
  color: string; // Expecting a Tailwind CSS background color class e.g., 'bg-blue-500'
  notes?: string;
}

export interface MasterDay {
  id: number;
  dateKey: string | null;
  color: string;
  name: string;
  colorName: string;
}

export interface ActivityCategory {
  id: string;
  name: string;
  color: string;
}
