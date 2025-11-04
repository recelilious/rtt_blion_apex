import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Phase = 'idle' | 'waiting' | 'red' | 'showResult' | 'finished'

type LeaderboardEntry = {
  rank: number
  reactiountime: number
  time: string
  code: string
  info: string
}

const TOTAL_ATTEMPTS = 5

export default function App() {
  const IDLE_MSG = '点击屏幕开始\n等待红色点击\n绿色时点击失败'
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [attempts, setAttempts] = useState<number[]>([])
  const [message, setMessage] = useState<string>(IDLE_MSG)
  const redStartRef = useRef<number | null>(null)
  const greenTimerRef = useRef<number | null>(null)
  const timeoutTimerRef = useRef<number | null>(null)
  const [average, setAverage] = useState<number | null>(null)
  const [info, setInfo] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedCode, setSubmittedCode] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)
  const [showNotice, setShowNotice] = useState<boolean>(true)

  const estimatedRank = useMemo(() => {
    if (average == null) return null
    if (!leaderboard || leaderboard.length === 0) return 1
    // 按当前榜单估算：放在所有 <= 平均值 的后面
    const count = leaderboard.filter(e => e.reactiountime <= average).length
    return count + 1
  }, [average, leaderboard])

  const bgClass = useMemo(() => {
    if (phase === 'waiting') return 'bg-green-500'
    if (phase === 'red') return 'bg-red-600'
    return 'bg-white'
  }, [phase])

  const clearTimers = () => {
    if (greenTimerRef.current) {
      clearTimeout(greenTimerRef.current)
      greenTimerRef.current = null
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current)
      timeoutTimerRef.current = null
    }
  }

  const startTrial = useCallback(() => {
    clearTimers()
    setMessage('准备... 变红后尽快点击')
    setPhase('waiting')
    // random 1-5s then turn red
    const delay = 1000 + Math.random() * 4000
    greenTimerRef.current = window.setTimeout(() => {
      setPhase('red')
      redStartRef.current = performance.now()
      setMessage('红色！快点！')
      // timeout after 3s without click
      timeoutTimerRef.current = window.setTimeout(() => {
        setMessage('超时，重来本次')
        setPhase('idle')
        redStartRef.current = null
      }, 3000)
    }, delay)
  }, [])

  const onClickScreen = useCallback(() => {
    if (showNotice) return
    if (phase === 'idle') {
      // either start first trial or retry current trial
      startTrial()
      return
    }
    if (phase === 'waiting') {
      // false start
      clearTimers()
      setMessage('过早点击！重来本次')
      setPhase('idle')
      redStartRef.current = null
      return
    }
    if (phase === 'red') {
      const t0 = redStartRef.current
      if (t0 == null) return
      const rt = Math.round(performance.now() - t0)
      clearTimers()
      setAttempts(prev => {
        const next = [...prev, rt]
        if (next.length >= TOTAL_ATTEMPTS) {
          const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length)
          setAverage(avg)
          setPhase('finished')
          setMessage(`完成！平均反应时间：${avg} ms`)
        } else {
          setPhase('showResult')
          setMessage(`本次：${rt} ms，准备下一次 (${next.length}/${TOTAL_ATTEMPTS})`)
          // brief pause then next trial
          setTimeout(() => {
            setPhase('idle')
            setMessage(IDLE_MSG)
          }, 800)
        }
        return next
      })
      redStartRef.current = null
      return
    }
  }, [phase, startTrial, showNotice])

  useEffect(() => {
    return () => clearTimers()
  }, [])

  const canSubmit = phase === 'finished' && average != null && submittedCode != null && !submitting

  const submitResult = async () => {
    if (!canSubmit || average == null) return
    try {
      setSubmitting(true)
      // try to copy the 6-digit code to clipboard before submitting
      if (submittedCode) {
        const copyToClipboard = async (text: string) => {
          try {
            await navigator.clipboard.writeText(text)
            return true
          } catch {
            // fallback to textarea + execCommand
            try {
              const ta = document.createElement('textarea')
              ta.value = text
              ta.style.position = 'fixed'
              ta.style.left = '-9999px'
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
              return true
            } catch {
              try {
                // ensure removal if something failed
                const existing = document.querySelector('textarea')
                if (existing && existing.parentElement) existing.parentElement.removeChild(existing)
              } catch { }
              return false
            }
          }
        }

        const copied = await copyToClipboard(submittedCode)
        if (copied) {
          // show a clear copied message before submitting
          setMessage(`已复制凭证：${submittedCode}`)
        } else {
          setMessage(`复制凭证失败，正在提交...（请手动保存：${submittedCode}）`)
        }
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionTime: average, info, code: submittedCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '提交失败')
      // Keep the code the same as pre-allocated; backend echoes the same code
      setSubmittedCode(data.code)
      setLeaderboard(data.leaderboard)
      setMessage(`提交成功！你的代号：${data.code}`)
      navigate('/leaderboard')
    } catch (e: any) {
      alert(e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      if (res.ok) setLeaderboard(data)
    } catch { }
  }

  useEffect(() => {
    if (phase === 'finished') {
      if (!leaderboard) fetchLeaderboard()
      // Pre-allocate a code when entering finished phase
      if (!submittedCode) {
        fetch('/api/new-code').then(async r => {
          const data = await r.json()
          if (r.ok && data?.code) setSubmittedCode(data.code)
        }).catch(() => { })
      }
    }
  }, [phase])

  return (
    <div
      className={`w-screen h-screen ${bgClass} select-none flex items-center justify-center`}
      onClick={onClickScreen}
    >
      <div className="max-w-2xl w-full p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">反应测试</h1>
          {phase === 'idle' ? (
            <div className="text-lg mb-4 leading-relaxed">
              <div>点击屏幕开始</div>
              <div>等待<span className="text-red-600 font-semibold">红色</span>点击</div>
              <div><span className="text-green-500 font-semibold">绿色</span>时点击失败</div>
            </div>
          ) : (
            <p className="text-lg mb-4">{message}</p>
          )}
          {phase !== 'finished' && (
            <div className="text-sm text-gray-600 mb-2">测试次数：{attempts.length}/{TOTAL_ATTEMPTS}</div>
          )}

          {phase === 'finished' && (
            <div className="bg-white rounded p-4 text-left shadow">
              <div className="mb-2">5 次成绩：{attempts.map((v, i) => `${i + 1}:${v}ms`).join(' / ')}</div>
              <div className="mb-4 font-semibold">平均：{average} ms{estimatedRank ? `（预计排名：第${estimatedRank}名）` : ''}</div>

              {submittedCode && (
                <div className="mb-3 p-3 border rounded bg-gray-50">
                  <div className="text-sm text-gray-600 mb-1">你的 6 位代号</div>
                  <div className="font-mono text-2xl tracking-widest">{submittedCode}</div>
                  <div className="mt-2 text-sm text-gray-700">
                    请提交此次记录后使用此代号领取奖品，请使用<strong>截图、复制</strong>等方式妥善保存此代号（具体领取方式见 NNU_APEX QQ 群内通知）
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">额外信息（如果你不在仙林校区或者可能无法在指定时间领取，请填写你的联系方式，例如手机号、qq号或者微信号，以便我们联系到你，≤ 32 字）</label>
                <input
                  type="text"
                  value={info}
                  maxLength={32}
                  onChange={e => setInfo(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="可留空"
                />
              </div>
              <div className="flex justify-center">
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-60"
                  disabled={!canSubmit}
                  onClick={(e) => { e.stopPropagation(); submitResult() }}
                >复制凭证、提交成绩并查看排行榜</button>
              </div>
            </div>
          )}
          {showNotice && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <div className="bg-white max-w-2xl w-[90%] md:w-[700px] rounded shadow-lg p-5 text-left">
                <h2 className="text-xl font-bold mb-3">活动说明</h2>
                <div className="text-sm text-gray-800 space-y-2">
                  <p>本测试是南京师范大学电竞社 <strong>NNU_APEX</strong> 分部百团小游戏活动，在参加前请知晓以下信息：</p>
                  <p>1. 本测试并非专业测试，有一定页面延迟影响，结果会偏大，结果仅供<strong>排名</strong>使用。</p>
                  <p>2. 本测试<strong>不会主动收集您的数据</strong>，因此领取奖品需要自行保存<strong>6位数字凭证</strong>。</p>
                  <p>3. 本测试是南京师范大学 <strong>NNU_APEX</strong> 分部活动，因此需要保证您已加入 <strong>NNU_APEX QQ群：280807276</strong>，领取奖品信息等请认准群内通知。</p>
                  <p>4. 本测试可以<strong>无限次重复</strong>，但是<strong>只会保存您点击提交按钮后的数据</strong>。</p>
                  <p>5. 如果您只是想要查看排行榜，可以使用 <strong>/leaderboard</strong> 直接查看。</p>
                  <p>6. 本测试<strong>不含反作弊功能</strong>，您大可以使用脚本或前端劫持方式上传数据；但<strong>活动最终解释权归开发者所有</strong>，若判定数据明显为作弊产生，我们将保留<strong>取消成绩</strong>的权利。</p>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button className="px-4 py-2 border rounded" onClick={() => navigate('/leaderboard')}>查看排行榜</button>
                  <button className="px-4 py-2 bg-black text-white rounded" onClick={() => setShowNotice(false)}>我知道了</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
