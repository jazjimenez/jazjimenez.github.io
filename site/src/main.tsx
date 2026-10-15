import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: its dev-only double mount races drei's <Html> portals in the 3D room.
createRoot(document.getElementById('root')!).render(<App />)
