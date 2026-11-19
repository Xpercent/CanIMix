import { Iphone } from '@/components/ui/iphone'
import { PairingApp } from '@/components/pairing/PairingApp'
import '@/components/pairing/pairing.css'

function App() {
  return (
    <main className="po-stage">
      <Iphone className="po-phone h-[min(calc(100svh-3rem),calc((100vw-3rem)/0.492))] w-auto max-w-none [--border:oklch(0.34_0_0)] [--card:oklch(0.18_0_0)]">
        <div className="po-viewport">
          <PairingApp />
        </div>
      </Iphone>
    </main>
  )
}

export default App