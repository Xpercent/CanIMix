import { Iphone } from '@/components/ui/iphone'

function App() {
  return (
    // 浅色画布 + 黑色机身：官方暗色 demo 的机身配色，放在亮色页面上
    <main className="flex min-h-svh items-center justify-center bg-muted/50 p-6">
      {/*
        尺寸随窗口自适应：高度取「视口高 - 留白」和「视口宽反推的最大高度」中的较小值，
        宽度交给 aspect-ratio(434:882) 自己算，所以永远不会溢出视口，也不会拉伸变形。
        留白 3rem 与下方公式保持一致。
      */}
      <Iphone className="h-[min(calc(100svh-3rem),calc((100vw-3rem)/0.492))] w-auto max-w-none [--border:oklch(0.34_0_0)] [--card:oklch(0.18_0_0)]">
        {/* 屏幕内容：目前为空，App 直接写在这里（填满整屏，四周会被圆角裁切） */}
      </Iphone>
    </main>
  )
}

export default App
