import { useEffect, useState } from 'react'

type LeaderboardEntry = {
  rank: number
  reactiountime: number
  time: string
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/leaderboard')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || '加载失败')
        setRows(data)
      } catch (e: any) {
        setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">排行榜</h1>
        {loading && <div className="text-center">加载中...</div>}
        {error && <div className="text-center text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="bg-white rounded p-4 shadow">
            <div className="grid grid-cols-3 gap-2 text-sm font-medium">
              <div>名次</div>
              <div>反应时间(ms)</div>
              <div>完成时间</div>
            </div>
            <div className="max-h-[70vh] overflow-auto divide-y">
              {rows.map(r => (
                <div key={`${r.rank}-${r.time}`} className={`grid grid-cols-3 gap-2 py-1 text-sm ${r.rank <= 5 ? 'font-semibold' : ''}`}>
                  <div>{r.rank}</div>
                  <div>{r.reactiountime}</div>
                  <div className="truncate" title={r.time}>{new Date(r.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">排名可能变动，请根据最终排行榜为准</div>
          </div>
        )}
      </div>
    </div>
  )
}
