import React, { useRef } from 'react';
import { Task, User } from '@shared/types/models';
import { MultiViewTasks } from './MultiViewTasks';

interface Props {
  tasks: Task[];
  currentUser: User;
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  selectedProjectId?: string;
}

export const CalendarTasksView: React.FC<Props> = (props) => {
  const initialized = useRef(false);
  if (!initialized.current && typeof window !== 'undefined') {
    window.localStorage.setItem('task_view_mode_v2', 'CALENDAR');
    initialized.current = true;
  }
  return <MultiViewTasks {...props} />;
};
