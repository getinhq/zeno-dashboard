import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// —— Projects ——
export function useProjects(params = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.code) search.set('code', params.code);
  const qs = search.toString();
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => api.get(`/api/v1/projects${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/projects', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useProject(projectId) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/api/v1/projects/${projectId}`),
    enabled: !!projectId,
  });
}

// —— Assets ——
export function useAssets(projectId, params = {}) {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.code) search.set('code', params.code);
  const qs = search.toString();
  return useQuery({
    queryKey: ['assets', projectId, params],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/assets${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

// —— Versions (by asset) ——
export function useAssetVersions(assetId, pipelineStage = '') {
  const search = new URLSearchParams();
  search.set('pipeline_stage', pipelineStage ?? '');
  const qs = search.toString();
  return useQuery({
    queryKey: ['asset_versions', assetId, pipelineStage ?? ''],
    queryFn: () => api.get(`/api/v1/assets/${assetId}/versions?${qs}`),
    enabled: !!assetId,
  });
}

export function useUpdateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, body }) => api.patch(`/api/v1/versions/${versionId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset_versions'] });
    },
  });
}

export function useAsset(assetId) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => api.get(`/api/v1/assets/${assetId}`),
    enabled: !!assetId,
  });
}

export function useUpdateAsset(assetId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/assets/${assetId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(['asset', assetId], data);
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

// —— Shots (by sequence) ——
export function useShots(sequenceId, params = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.shot_code) search.set('shot_code', params.shot_code);
  const qs = search.toString();
  return useQuery({
    queryKey: ['shots', sequenceId, params],
    queryFn: () => api.get(`/api/v1/sequences/${sequenceId}/shots${qs ? `?${qs}` : ''}`),
    enabled: !!sequenceId,
  });
}

export function useProjectShots(projectId, params = {}) {
  const search = new URLSearchParams();
  (params.episode_ids || []).forEach((id) => search.append('episode_ids', id));
  (params.sequence_ids || []).forEach((id) => search.append('sequence_ids', id));
  if (params.stage) search.set('stage', params.stage);
  if (params.search) search.set('search', params.search);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));
  const qs = search.toString();
  return useQuery({
    queryKey: ['project_shots', projectId, params],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/shots${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

export function useShot(shotId) {
  return useQuery({
    queryKey: ['shot', shotId],
    queryFn: () => api.get(`/api/v1/shots/${shotId}`),
    enabled: !!shotId,
  });
}

export function useSequence(sequenceId) {
  return useQuery({
    queryKey: ['sequence', sequenceId],
    queryFn: () => api.get(`/api/v1/sequences/${sequenceId}`),
    enabled: !!sequenceId,
  });
}

// —— Episodes (by project) ——
export function useEpisodes(projectId, params = {}) {
  const search = new URLSearchParams();
  if (params.code) search.set('code', params.code);
  const qs = search.toString();
  return useQuery({
    queryKey: ['episodes', projectId, params],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/episodes${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

// —— Sequences (by episode) ——
export function useSequences(episodeId, params = {}) {
  const search = new URLSearchParams();
  if (params.code) search.set('code', params.code);
  const qs = search.toString();
  return useQuery({
    queryKey: ['sequences', episodeId, params],
    queryFn: () => api.get(`/api/v1/episodes/${episodeId}/sequences${qs ? `?${qs}` : ''}`),
    enabled: !!episodeId,
  });
}

export function useProjectSequences(projectId, params = {}) {
  const search = new URLSearchParams();
  (params.episode_ids || []).forEach((id) => search.append('episode_ids', id));
  if (params.stage) search.set('stage', params.stage);
  if (params.search) search.set('search', params.search);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));
  const qs = search.toString();
  return useQuery({
    queryKey: ['project_sequences', projectId, params],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/sequences${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

// —— Mutations for entities ——
export function useCreateAsset(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/projects/${projectId}/assets`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', projectId] });
      // Task templates create the asset's tasks server-side.
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateEpisode(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/projects/${projectId}/episodes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['episodes', projectId] }),
  });
}

export function useCreateSequence(episodeId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/episodes/${episodeId}/sequences`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences', episodeId] }),
  });
}

export function useUpdateSequence(sequenceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/sequences/${sequenceId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
      qc.invalidateQueries({ queryKey: ['project_sequences'] });
      qc.invalidateQueries({ queryKey: ['sequence', sequenceId] });
    },
  });
}

export function useCreateShot(sequenceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/sequences/${sequenceId}/shots`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shots', sequenceId] });
      qc.invalidateQueries({ queryKey: ['project_shots'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateShot(shotId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/shots/${shotId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shots'] });
      qc.invalidateQueries({ queryKey: ['project_shots'] });
      qc.invalidateQueries({ queryKey: ['shot', shotId] });
    },
  });
}

// —— Tasks ——
/** refetchInterval: optional ms for polling (realtime-ready). Pass 0 to disable. */
export function useTasks(filters = {}, options = {}) {
  const { refetchInterval, enabled } = options;
  const search = new URLSearchParams();
  if (filters.project_id) search.set('project_id', filters.project_id);
  if (filters.asset_id) search.set('asset_id', filters.asset_id);
  if (filters.shot_id) search.set('shot_id', filters.shot_id);
  if (filters.type) search.set('type', filters.type);
  if (filters.status) search.set('status', filters.status);
  if (filters.assignee_id) search.set('assignee_id', filters.assignee_id);
  if (filters.department) search.set('department', filters.department);
  const qs = search.toString();
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.get(`/api/v1/tasks${qs ? `?${qs}` : ''}`),
    ...(refetchInterval != null && { refetchInterval }),
    ...(enabled != null && { enabled }),
  });
}

/** Tasks with polling for dashboard/reviews. Swap to WebSocket later if needed. */
export function useTasksWithPolling(filters = {}, intervalMs = 30_000) {
  return useTasks(filters, { refetchInterval: intervalMs });
}

export function useTask(taskId) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get(`/api/v1/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function useTaskVersions(taskId) {
  return useQuery({
    queryKey: ['task_versions', taskId],
    queryFn: () => api.get(`/api/v1/tasks/${taskId}/versions`),
    enabled: !!taskId,
  });
}

export function useUpdateTask(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/tasks/${taskId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(['task', taskId], data);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['task_stats'] });
    },
  });
}

/** Optimistic update: apply patch to cache immediately, rollback on error. */
export function useUpdateTaskMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, body }) => api.patch(`/api/v1/tasks/${taskId}`, body),
    onMutate: async ({ taskId, body }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueriesData({ queryKey: ['tasks'] });
      qc.setQueriesData({ queryKey: ['tasks'] }, (data) => {
        if (!data || !Array.isArray(data)) return data;
        return data.map((t) => (t.id === taskId ? { ...t, ...body } : t));
      });
      await qc.cancelQueries({ queryKey: ['task', taskId] });
      const taskPrev = qc.getQueryData(['task', taskId]);
      if (taskPrev) qc.setQueryData(['task', taskId], { ...taskPrev, ...body });
      return { previous, taskPrev: taskPrev ? { taskId, data: taskPrev } : null };
    },
    onError: (_err, { taskId, body }, context) => {
      if (context?.previous) {
        context.previous.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data));
      }
      if (context?.taskPrev) {
        qc.setQueryData(['task', context.taskPrev.taskId], context.taskPrev.data);
      }
    },
    onSettled: (_, __, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['task_stats'] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/tasks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['task_stats'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useTaskStats(projectId, { mine = false, refetchInterval } = {}) {
  return useQuery({
    queryKey: ['task_stats', projectId, mine],
    queryFn: () => {
      const search = new URLSearchParams();
      search.set('project_id', projectId);
      if (mine) search.set('mine', 'true');
      return api.get(`/api/v1/tasks/stats?${search.toString()}`);
    },
    enabled: !!projectId,
    ...(refetchInterval != null && { refetchInterval }),
  });
}

export function useMyTasks(projectId, options = {}) {
  const { refetchInterval } = options;
  return useQuery({
    queryKey: ['tasks_mine', projectId],
    queryFn: () => {
      const search = new URLSearchParams();
      if (projectId) search.set('project_id', projectId);
      const qs = search.toString();
      return api.get(`/api/v1/tasks/mine${qs ? `?${qs}` : ''}`);
    },
    enabled: !!projectId,
    ...(refetchInterval != null && { refetchInterval }),
  });
}

// —— Events / Recent Activity ——
export function useEvents(projectId, { limit = 20, refetchInterval } = {}) {
  return useQuery({
    queryKey: ['events', projectId, limit, ''],
    queryFn: () => {
      const search = new URLSearchParams();
      if (projectId) search.set('project_id', projectId);
      if (limit) search.set('limit', String(limit));
      return api.get(`/api/v1/events?${search.toString()}`);
    },
    enabled: !!projectId,
    ...(refetchInterval != null && { refetchInterval }),
  });
}

export function useTaskEvents(projectId, taskId, { limit = 50, refetchInterval } = {}) {
  return useQuery({
    queryKey: ['events', projectId, limit, taskId || ''],
    queryFn: () => {
      const search = new URLSearchParams();
      if (projectId) search.set('project_id', projectId);
      if (taskId) search.set('task_id', taskId);
      if (limit) search.set('limit', String(limit));
      return api.get(`/api/v1/events?${search.toString()}`);
    },
    enabled: !!projectId && !!taskId,
    ...(refetchInterval != null && { refetchInterval }),
  });
}

// —— Notifications ——
export function useNotifications(projectId, { refetchInterval = 30_000, unreadOnly = false } = {}) {
  return useQuery({
    queryKey: ['notifications', projectId, unreadOnly],
    queryFn: () => {
      const search = new URLSearchParams();
      if (projectId) search.set('project_id', projectId);
      if (unreadOnly) search.set('unread_only', 'true');
      return api.get(`/api/v1/notifications?${search.toString()}`);
    },
    enabled: !!projectId,
    refetchInterval,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/notifications/mark-read', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// —— Users ——
export function useUsers(params = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.app_role) search.set('app_role', params.app_role);
      if (params.is_active != null) search.set('is_active', String(params.is_active));
      const qs = search.toString();
      return api.get(`/api/v1/users${qs ? `?${qs}` : ''}`);
    },
  });
}

// —— Issues ——
export function useIssues(projectId, options = {}) {
  const {
    status,
    dcc,
    reporter_id,
    assignee_id,
    asset_id,
    shot_id,
    refetchInterval,
  } = options;
  return useQuery({
    queryKey: [
      'issues',
      projectId,
      status || '',
      dcc || '',
      reporter_id || '',
      assignee_id || '',
      asset_id || '',
      shot_id || '',
    ],
    queryFn: () => {
      const search = new URLSearchParams();
      if (projectId) search.set('project_id', projectId);
      if (status) search.set('status', status);
      if (dcc) search.set('dcc', dcc);
      if (reporter_id) search.set('reporter_id', reporter_id);
      if (assignee_id) search.set('assignee_id', assignee_id);
      if (asset_id) search.set('asset_id', asset_id);
      if (shot_id) search.set('shot_id', shot_id);
      return api.get(`/api/v1/issues?${search.toString()}`);
    },
    enabled: !!projectId,
    ...(refetchInterval != null && { refetchInterval }),
  });
}

export function useIssue(issueId) {
  return useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => api.get(`/api/v1/issues/${issueId}`),
    enabled: !!issueId,
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/issues', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateIssue(issueId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/issues/${issueId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue', issueId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/**
 * Upload a single file as an attachment for ``issueId``. Returns the created
 * attachment record. The mutation accepts ``{ file, filename? }``; on success
 * the issue query is invalidated so the detail view refreshes.
 */
export function useUploadIssueAttachment(issueId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, filename }) => {
      const fd = new FormData();
      fd.append('file', file, filename || file.name);
      if (filename) fd.append('filename', filename);
      return api.postForm(`/api/v1/issues/${issueId}/attachments/upload`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', issueId] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

// —— Organization / team ——
export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/api/v1/organization'),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch('/api/v1/organization', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/api/v1/invites'),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/invites', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useRegenerateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId) => api.post(`/api/v1/invites/${inviteId}/regenerate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId) => api.delete(`/api/v1/invites/${inviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }) => api.patch(`/api/v1/users/${userId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

// —— Task templates ——
export function useTaskTemplates() {
  return useQuery({
    queryKey: ['task_templates'],
    queryFn: () => api.get('/api/v1/task-templates'),
  });
}

export function useTaskVocabulary() {
  return useQuery({
    queryKey: ['task_vocabulary'],
    queryFn: () => api.get('/api/v1/task-templates/vocabulary'),
    staleTime: Infinity,
  });
}

export function useSaveTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) =>
      id ? api.patch(`/api/v1/task-templates/${id}`, body) : api.post('/api/v1/task-templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task_templates'] }),
  });
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/v1/task-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task_templates'] }),
  });
}

export function useApplyTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.post(`/api/v1/task-templates/${id}/apply`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// —— Casting / breakdown ——
export function useBreakdown(projectId) {
  return useQuery({
    queryKey: ['breakdown', projectId],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/breakdown`),
    enabled: !!projectId,
  });
}

/** Optimistic grid toggles: the cell flips immediately and rolls back if the save fails. */
export function useUpdateBreakdown(projectId) {
  const qc = useQueryClient();
  const key = ['breakdown', projectId];
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/projects/${projectId}/breakdown`, body),
    onMutate: async ({ add = [], remove = [] }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      if (previous) {
        const removeKeys = new Set(remove.map((x) => `${x.shot_id}:${x.asset_id}`));
        const links = previous.links.filter((l) => !removeKeys.has(`${l.shot_id}:${l.asset_id}`));
        const have = new Set(links.map((l) => `${l.shot_id}:${l.asset_id}`));
        add.forEach((x) => {
          if (!have.has(`${x.shot_id}:${x.asset_id}`)) links.push({ id: `tmp-${x.shot_id}-${x.asset_id}`, ...x });
        });
        qc.setQueryData(key, { ...previous, links });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

// —— Schedule ——
export function useSchedule(projectId) {
  return useQuery({
    queryKey: ['schedule', projectId],
    queryFn: () => api.get(`/api/v1/projects/${projectId}/schedule`),
    enabled: !!projectId,
  });
}

function useScheduleMutation(projectId, mutationFn, extra = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['schedule', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    ...extra,
  });
}

export function useAutoSchedule(projectId) {
  return useScheduleMutation(projectId, (body) => api.post(`/api/v1/projects/${projectId}/schedule/auto`, body));
}

/** Move/resize a bar; the bar moves immediately and snaps back if the save fails. */
export function useSetTaskDates(projectId) {
  const qc = useQueryClient();
  const key = ['schedule', projectId];
  return useScheduleMutation(
    projectId,
    ({ taskId, start_date, due_date }) => api.patch(`/api/v1/tasks/${taskId}/dates`, { start_date, due_date }),
    {
      onMutate: async ({ taskId, start_date, due_date }) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData(key);
        if (previous) {
          qc.setQueryData(key, {
            ...previous,
            tasks: previous.tasks.map((t) => (t.id === taskId ? { ...t, start_date, due_date } : t)),
          });
        }
        return { previous };
      },
      onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    },
  );
}

export function useAddDependency(projectId) {
  return useScheduleMutation(projectId, ({ taskId, dependsOn }) =>
    api.post(`/api/v1/tasks/${taskId}/dependencies`, { depends_on: dependsOn }),
  );
}

export function useRemoveDependency(projectId) {
  return useScheduleMutation(projectId, ({ taskId, dependsOn }) =>
    api.delete(`/api/v1/tasks/${taskId}/dependencies/${dependsOn}`),
  );
}

export function useSaveMilestone(projectId) {
  return useScheduleMutation(projectId, ({ id, body }) =>
    id ? api.patch(`/api/v1/milestones/${id}`, body) : api.post(`/api/v1/projects/${projectId}/milestones`, body),
  );
}

export function useDeleteMilestone(projectId) {
  return useScheduleMutation(projectId, (id) => api.delete(`/api/v1/milestones/${id}`));
}

// —— Personal access tokens ——
export function useApiTokens() {
  return useQuery({ queryKey: ['api_tokens'], queryFn: () => api.get('/api/v1/auth/tokens') });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/auth/tokens', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api_tokens'] }),
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/v1/auth/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api_tokens'] }),
  });
}

// —— Review ——
const PROCESSING = new Set(['queued', 'processing']);

export function useReviewItems(params = {}, options = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  return useQuery({
    queryKey: ['review_items', params],
    queryFn: () => api.get(`/api/v1/reviews/items?${search.toString()}`),
    enabled: options.enabled ?? !!(params.project_id || params.task_id || params.shot_id || params.asset_id),
    // Keep polling while anything is still converting.
    refetchInterval: (q) => (q.state.data || []).some((i) => PROCESSING.has(i.processing_status)) ? 3000 : options.refetchInterval ?? false,
  });
}

export function useReviewItem(itemId) {
  return useQuery({
    queryKey: ['review_item', itemId],
    queryFn: () => api.get(`/api/v1/reviews/items/${itemId}`),
    enabled: !!itemId,
    refetchInterval: (q) => (PROCESSING.has(q.state.data?.processing_status) ? 2000 : false),
  });
}

function useReviewNotesCache() {
  const qc = useQueryClient();
  return (itemId, notes) => {
    if (!notes) return;
    // Notes belong to the task: every cached revision of it shows the same list.
    const item = qc.getQueryData(['review_item', itemId]);
    qc.getQueriesData({ queryKey: ['review_item'] }).forEach(([key, data]) => {
      if (data && (data.id === itemId || (item && data.task_id === item.task_id))) {
        qc.setQueryData(key, { ...data, notes });
      }
    });
    qc.invalidateQueries({ queryKey: ['review_items'] });
  };
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, file, files, frameStart, fps, description, onProgress }) => {
      const fd = new FormData();
      fd.append('task_id', taskId);
      if (files?.length > 1) {
        // Image sequence: one part per frame; the server stores each frame once by hash.
        files.forEach((f) => fd.append('files', f));
        if (fps) fd.append('fps', String(fps));
        if (description) fd.append('description', description);
        return api.uploadWithProgress('/api/v1/reviews/items/sequence/upload', fd, onProgress);
      }
      fd.append('file', file);
      if (frameStart !== '' && frameStart != null) fd.append('frame_start', String(frameStart));
      if (fps) fd.append('fps', String(fps));
      if (description) fd.append('description', description);
      return api.uploadWithProgress('/api/v1/reviews/items', fd, onProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review_items'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useReviewDecision(itemId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/reviews/items/${itemId}/decision`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review_item'] });
      qc.invalidateQueries({ queryKey: ['review_items'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAddReviewNote(itemId) {
  const apply = useReviewNotesCache();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/reviews/items/${itemId}/notes`, body),
    onSuccess: (data) => apply(itemId, data?.notes),
  });
}

export function useUpdateReviewNote(itemId) {
  const apply = useReviewNotesCache();
  return useMutation({
    mutationFn: ({ noteId, ...body }) => api.patch(`/api/v1/reviews/notes/${noteId}`, body),
    onSuccess: (data) => apply(itemId, data?.notes),
  });
}

export function useDeleteReviewNote(itemId) {
  const apply = useReviewNotesCache();
  return useMutation({
    mutationFn: (noteId) => api.delete(`/api/v1/reviews/notes/${noteId}`),
    onSuccess: (data) => apply(itemId, data?.notes),
  });
}

export function useDeleteReviewItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId) => api.delete(`/api/v1/reviews/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review_items'] }),
  });
}

export function useReviewShares(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['review_shares', projectId],
    queryFn: () => api.get(`/api/v1/reviews/shares?project_id=${projectId}`),
    enabled: !!projectId && enabled,
  });
}

export function useCreateReviewShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/reviews/shares', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review_shares'] }),
  });
}

export function useRevokeReviewShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/v1/reviews/shares/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review_shares'] }),
  });
}
