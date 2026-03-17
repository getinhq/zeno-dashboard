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
export function useAssetVersions(assetId) {
  return useQuery({
    queryKey: ['asset_versions', assetId],
    queryFn: () => api.get(`/api/v1/assets/${assetId}/versions`),
    enabled: !!assetId,
  });
}

export function useAsset(assetId) {
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => api.get(`/api/v1/assets/${assetId}`),
    enabled: !!assetId,
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

export function useShot(shotId) {
  return useQuery({
    queryKey: ['shot', shotId],
    queryFn: () => api.get(`/api/v1/shots/${shotId}`),
    enabled: !!shotId,
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

export function useCreateShot(sequenceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/api/v1/sequences/${sequenceId}/shots`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shots', sequenceId] }),
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

export function useUpdateTask(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch(`/api/v1/tasks/${taskId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(['task', taskId], data);
      qc.invalidateQueries({ queryKey: ['tasks'] });
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
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/api/v1/tasks', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
