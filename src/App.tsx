import { Iphone } from '@/components/ui/iphone'

function App() {
  return (
    // 浅色画布 + 黑色机身：官方暗色 demo 的机身配色，放在亮色页面上
    <main className="flex min-h-svh items-center justify-center bg-muted/50 p-8">
      {/*
        尺寸随窗口自适应：高度取「视口高 - 留白」和「视口宽反推的最大高度」中的较小值，
        宽度交给 aspect-ratio(434:882) 自己算，所以永远不会溢出视口，也不会拉伸变形。
        留白 8rem 与下方公式保持一致，机身四周各留 64px 呼吸空间。
      */}
      <Iphone className="h-[min(calc(100svh-8rem),calc((100vw-8rem)/0.492))] w-auto max-w-none [--border:oklch(0.34_0_0)] [--card:oklch(0.18_0_0)]">
        {/* 屏幕：先用 CSS 渐变模拟官方 demo 的满屏壁纸，之后换成截图传 src="/screens/home.png" */}
        <div
          className="size-full"
          style={{
            backgroundImage: [
              'radial-gradient(120% 80% at 20% 0%, oklch(0.78 0.16 320 / 0.95), transparent 60%)',
              'radial-gradient(100% 70% at 85% 100%, oklch(0.78 0.14 195 / 0.95), transparent 62%)',
              'linear-gradient(165deg, oklch(0.72 0.19 305), oklch(0.55 0.22 295) 48%, oklch(0.78 0.13 200))',
            ].join(', '),
          }}
        />
      </Iphone>
    </main>
  )
}

export default App
