import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { applyAppearancePrefs } from "@/utils/beculturePrefs";

import "./i18n/config";

import "simplebar-react/dist/simplebar.min.css";

import "./styles/index.css";

// Aplica as preferências de aparência (fundo/vinheta) antes do primeiro render,
// para que a escolha do usuário persista entre recarregamentos.
applyAppearancePrefs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
