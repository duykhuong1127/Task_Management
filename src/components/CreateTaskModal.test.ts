import { describe, expect, it } from 'vitest';
import { Project } from '@shared/types/models';
import { resolveCreateTaskProjectId } from './CreateTaskModal';

const projects = [
  { projectId: 'project-01' },
  { projectId: 'project-demo' },
] as Project[];

describe('resolveCreateTaskProjectId', () => {
  it('uses the project currently selected in the sidebar', () => {
    expect(resolveCreateTaskProjectId(projects, 'project-demo')).toBe('project-demo');
  });

  it('falls back to the first available project when there is no valid selection', () => {
    expect(resolveCreateTaskProjectId(projects)).toBe('project-01');
    expect(resolveCreateTaskProjectId(projects, 'missing-project')).toBe('project-01');
  });

  it('returns an empty selection when the user has no projects', () => {
    expect(resolveCreateTaskProjectId([], 'project-demo')).toBe('');
  });
});
