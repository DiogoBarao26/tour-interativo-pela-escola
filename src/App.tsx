import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './admin/AdminLayout';
import { AppearancePage } from './admin/AppearancePage';
import { AudioAdminPage } from './admin/AudioAdminPage';
import { DashboardPage } from './admin/DashboardPage';
import { LoginPage } from './admin/LoginPage';
import { PuzzleAdminPage } from './admin/PuzzleAdminPage';
import { QuizAdminPage } from './admin/QuizAdminPage';
import { ReportsPage } from './admin/ReportsPage';
import { RequireAdmin } from './admin/guard';
import { SettingsPage } from './admin/SettingsPage';
import { WordsAdminPage } from './admin/WordsAdminPage';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import { AudioProvider } from './lib/audio';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PuzzlePage } from './pages/PuzzlePage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { WordsPage } from './pages/WordsPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export function App() {
  return (
    <ConfigProvider>
      <BrowserRouter basename={basename}>
        <AudioShell />
      </BrowserRouter>
    </ConfigProvider>
  );
}

function AudioShell() {
  const { config } = useConfig();
  return (
    <AudioProvider settings={config.audio}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tour/quiz" element={<QuizPage />} />
        <Route path="/tour/quebra-cabeca" element={<PuzzlePage />} />
        <Route path="/tour/nuvem" element={<WordsPage />} />
        <Route path="/tour/resultado" element={<ResultPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="aparencia" element={<AppearancePage />} />
            <Route path="quiz" element={<QuizAdminPage />} />
            <Route path="quebra-cabeca" element={<PuzzleAdminPage />} />
            <Route path="nuvem" element={<WordsAdminPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="sons" element={<AudioAdminPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AudioProvider>
  );
}
