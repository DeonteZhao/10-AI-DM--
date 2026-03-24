import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ModulesPage } from './pages/ModulesPage';
import { CharacterCreatePage } from './pages/CharacterCreatePage';
import { GamePage } from './pages/GamePage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: 'modules', Component: ModulesPage },
      { path: 'character/create', Component: CharacterCreatePage },
      { path: 'game/:adventureId', Component: GamePage },
    ],
  },
]);
