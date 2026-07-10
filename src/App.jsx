import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ProjectProvider } from '@/lib/ProjectContext'
import { RoleProvider } from '@/lib/RoleContext'
import { VersionProvider } from '@/lib/VersionContext'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';

// KB Manager pages
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Pipelines from './pages/Pipelines';
import PipelineDetail from './pages/PipelineDetail';
import Runs from './pages/Runs';
import Config from './pages/Config';
import KnowledgeBases from './pages/KnowledgeBases';
import SchemaValidator from './pages/SchemaValidator';
import TemplateManager from './pages/TemplateManager';
import SchemaExtraction from './pages/SchemaExtraction';
import DataSync from './pages/DataSync';
import VocabLinker from './pages/VocabLinker';
import VocabMaker from './pages/VocabMaker';
import VocabLinks from './pages/VocabLinks';
import AnnotationNotes from './pages/AnnotationNotes';
import PopulateSubObjects from './pages/PopulateSubObjects';
import ProvenanceViewer from './pages/ProvenanceViewer';
import VocabularyManager from './pages/VocabularyManager';
import ChecklistManager from './pages/ChecklistManager';
import FacetConfigEditor from './pages/FacetConfigEditor';

// KB User pages
import KBUserDashboard from './pages/kbuser/KBUserDashboard';
import KBSearch from './pages/kbuser/KBSearch';
import KBAnnotate from './pages/kbuser/KBAnnotate';
import KBMatch from './pages/kbuser/KBMatch';
import KBCompose from './pages/kbuser/KBCompose';
import KBPreferences from './pages/kbuser/KBPreferences';
import KBUserConfig from './pages/kbuser/KBUserConfig';
import KBDetailPolicies from './pages/kbuser/KBDetailPolicies';
import KBDetailActions from './pages/kbuser/KBDetailActions';
import KBDetailConstraints from './pages/kbuser/KBDetailConstraints';
import KBWorkflow from './pages/kbuser/KBWorkflow';

// V0.4 pages
import V04Dashboard from './pages/v04/Dashboard';
import V04Settings from './pages/v04/Settings';
import V04KBUserDashboard from './pages/v04/KBUserDashboard';
import V04KBApi from './pages/v04/KBApi';
import V04KBApiConfig from './pages/v04/KBApiConfig';
import V04KBApiDefinition from './pages/v04/KBApiDefinition';
import V04KBApiPreview from './pages/v04/KBApiPreview';
import V04KBApiPreviewStandalone from './pages/v04/KBApiPreviewStandalone';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* KB Manager */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/pipelines/:id" element={<PipelineDetail />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/config" element={<Config />} />
        <Route path="/knowledge-bases" element={<KnowledgeBases />} />
        <Route path="/schema-validator" element={<SchemaValidator />} />
        <Route path="/template-manager" element={<TemplateManager />} />
        <Route path="/schema-extraction" element={<SchemaExtraction />} />
        <Route path="/data-sync" element={<DataSync />} />
        <Route path="/vocab-linker" element={<VocabLinker />} />
        <Route path="/vocab-maker" element={<VocabMaker />} />
        <Route path="/vocab-links" element={<VocabLinks />} />
        <Route path="/annotation-notes" element={<AnnotationNotes />} />
        <Route path="/populate-subobjects" element={<PopulateSubObjects />} />
        <Route path="/provenance" element={<ProvenanceViewer />} />
        <Route path="/vocabulary-manager" element={<VocabularyManager />} />
        <Route path="/checklist-manager" element={<ChecklistManager />} />
        <Route path="/facet-config" element={<FacetConfigEditor />} />

        {/* KB User */}
        <Route path="/kb-user/dashboard" element={<KBUserDashboard />} />
        <Route path="/kb-user/search" element={<KBSearch />} />
        <Route path="/kb-user/annotate" element={<KBAnnotate />} />
        <Route path="/kb-user/match" element={<KBMatch />} />
        <Route path="/kb-user/compose" element={<KBCompose />} />
        <Route path="/kb-user/preferences" element={<KBPreferences />} />
        <Route path="/kb-user/configuration" element={<KBUserConfig />} />
        <Route path="/kb-user/detail/policies" element={<KBDetailPolicies />} />
        <Route path="/kb-user/detail/actions" element={<KBDetailActions />} />
        <Route path="/kb-user/detail/constraints" element={<KBDetailConstraints />} />
        <Route path="/kb-user/workflow" element={<KBWorkflow />} />

        {/* V0.4 */}
        <Route path="/v0.4/dashboard" element={<V04Dashboard />} />
        <Route path="/v0.4/settings" element={<V04Settings />} />
        <Route path="/v0.4/kb-user/dashboard" element={<V04KBUserDashboard />} />
        <Route path="/v0.4/kb-api" element={<V04KBApi />} />
        <Route path="/v0.4/kb-api/configuration" element={<V04KBApiConfig />} />
        <Route path="/v0.4/kb-api/definition" element={<V04KBApiDefinition />} />
        <Route path="/v0.4/kb-api/preview" element={<V04KBApiPreview />} />
        <Route path="/v0.4/kb-api/preview-standalone" element={<V04KBApiPreviewStandalone />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ProjectProvider>
          <VersionProvider>
          <RoleProvider>
            <Router>
              <AuthenticatedApp />
              <Toaster />
            </Router>
          </RoleProvider>
          </VersionProvider>
        </ProjectProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App