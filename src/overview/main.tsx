import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Overview } from './Overview'
import { Carousel } from '../carousel/Carousel'

const mode = new URLSearchParams(window.location.search).get('mode');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mode === 'carousel' ? <Carousel /> : <Overview />}
  </StrictMode>,
)
