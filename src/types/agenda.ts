import type { Task } from '@/types/calendar';

export type AgendaItemType = 'date-header' | 'task' | 'empty-state';

export type AgendaItem = {
  id: string;
  type: AgendaItemType;
  date: Date;
  task?: Task;
  height: number;
};

export function getAgendaItemType(item: AgendaItem): AgendaItemType {
  return item.type;
}
