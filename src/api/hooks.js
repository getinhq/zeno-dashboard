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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', projectId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shots', sequenceId] }),
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
  const { refetchInterval } = options;
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
