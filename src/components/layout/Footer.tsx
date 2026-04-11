const marqueeItems = [
  "Sirius Protocol",
  "Decentralized Data Lending",
  "Built on XRPL",
]

const MarqueeContent = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) =>
      marqueeItems.map((item, j) => (
        <span key={`${i}-${j}`} className="flex items-center">
          <span>{item}</span>
          <span className="mx-8 inline-block h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ))
    )}
  </>
)

export const FOOTER_H = 28

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-[55] pointer-events-none">
      <div className="overflow-hidden bg-white py-0.5">
        <div
          className="flex whitespace-nowrap text-xs uppercase tracking-wider text-background md:text-sm"
          style={{ animation: "marquee 20s linear infinite" }}
        >
          <span className="flex shrink-0 items-center"><MarqueeContent /></span>
          <span className="flex shrink-0 items-center"><MarqueeContent /></span>
        </div>
      </div>
    </footer>
  )
}
