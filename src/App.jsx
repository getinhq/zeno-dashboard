import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectProvider } from './contexts/ProjectContext';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Entities } from './pages/Entities';
import { Reviews } from './pages/Reviews';
import { Settings } from './pages/Settings';
import { Publish } from './pages/Publish';
import { Explorer } from './pages/Explorer';
import { Issues } from './pages/Issues';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AcceptInvite } from './pages/AcceptInvite';
import { Team } from './pages/Team';
import { Templates } from './pages/Templates';
import { NewProject } from './pages/NewProject';
import { Breakdown } from './pages/Breakdown';
import { Schedule } from './pages/Schedule';
import { Account } from './pages/Account';
import { GettingStarted } from './pages/GettingStarted';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, refetchOnWindowFocus: true },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route
                path="/"
                element={(
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                )}
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="entities" element={<Entities />} />
                <Route path="explorer" element={<Explorer />} />
                <Route path="breakdown" element={<Breakdown />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="account" element={<Account />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="task/:id" element={<TaskDetail />} />
                <Route path="tasks/:id" element={<TaskDetail />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="issues" element={<Issues />} />
                <Route
                  path="settings"
                  element={(
                    <RequireRole roles={['pipeline']}>
                      <Settings />
                    </RequireRole>
                  )}
                />
                <Route path="publish" element={<Publish />} />
                <Route path="getting-started" element={<GettingStarted />} />
                <Route
                  path="projects/new"
                  element={(
                    <RequireRole roles={['pipeline', 'supervisor', 'production']}>
                      <NewProject />
                    </RequireRole>
                  )}
                />
                <Route
                  path="templates"
                  element={(
                    <RequireRole roles={['pipeline', 'supervisor', 'production']}>
                      <Templates />
                    </RequireRole>
                  )}
                />
                <Route
                  path="team"
                  element={(
                    <RequireRole roles={['pipeline', 'supervisor', 'production']}>
                      <Team />
                    </RequireRole>
                  )}
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
