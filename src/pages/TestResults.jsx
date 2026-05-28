import { useState, useEffect, useRef } from 'react'
import { categoriesApi, testsApi } from '../api'

function StatusBadge({ status }) {
  const map = {
    pass: 'badge-pass',
    fail: 'badge-fail',
    running: 'badge-running',
    pending: 'badge-pending'
  }
  const labels = { pass: '✓ PASS', fail: '✗ FAIL', running: '⟳ Running...', pending: '– Pending' }
  return <span className={map[status] || 'badge-pending'}>{labels[status] || status}</span>
}

export default function TestResults() {
  const [categories, setCategories] = useState([])
  const [results, setResults] = useState([])
  const [running, setRunning] = useState({})
  const [selectedCat, setSelectedCat] = useState('all')
  const [expandedResults, setExpandedResults] = useState({})
  const [logs, setLogs] = useState({})
  const eventSourcesRef = useRef({})

  useEffect(() => {
    categoriesApi.list().then(r => setCategories(r.data))
    loadResults()
  }, [])

  const loadResults = () => {
    testsApi.getResults().then(r => setResults(r.data || []))
  }

  const runTest = (categoryId) => {
    setRunning(prev => ({ ...prev, [categoryId]: true }))
    setLogs(prev => ({ ...prev, [categoryId]: [] }))

    const es = new EventSource(`/test-events?categoryId=${categoryId}`)
    eventSourcesRef.current[categoryId] = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'log') {
          setLogs(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), data.message] }))
        } else if (data.type === 'complete') {
          es.close()
          setRunning(prev => ({ ...prev, [categoryId]: false }))
          loadResults()
        } else if (data.type === 'error') {
          es.close()
          setRunning(prev => ({ ...prev, [categoryId]: false }))
          setLogs(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), `❌ Error: ${data.message}`] }))
        }
      } catch {}
    }

    es.onerror = () => {
      es.close()
      setRunning(prev => ({ ...prev, [categoryId]: false }))
    }
  }

  const stopTest = (categoryId) => {
    eventSourcesRef.current[categoryId]?.close()
    setRunning(prev => ({ ...prev, [categoryId]: false }))
  }

  const clearResults = async (categoryId) => {
    if (!confirm('ลบผลการทดสอบทั้งหมดของ category นี้?')) return
    await testsApi.clearResults(categoryId)
    loadResults()
  }

  const toggleExpand = (resultId) => {
    setExpandedResults(prev => ({ ...prev, [resultId]: !prev[resultId] }))
  }

  const exportMarkdown = (result) => {
    let md = `# Test Report: ${result.category_name}\n\n`
    md += `**Date:** ${new Date(result.started_at).toLocaleString('th-TH')}\n`
    md += `**Status:** ${result.status.toUpperCase()}\n\n---\n\n`

    result.scenarios?.forEach((scen) => {
      md += `## Scenario: ${scen.scenario_name}\n\n`
      md += `**Run #${(scen.run_index || 0) + 1}** | Status: **${scen.status.toUpperCase()}**\n\n`
      md += `| Step | ข้อความที่ส่ง | Bot Response | Expected Keywords | Result |\n`
      md += `|------|-------------|--------------|-------------------|--------|\n`
      scen.steps?.forEach((step, si) => {
        const kw = step.expected_keywords?.join(', ') || '-'
        const pass = step.passed ? '✅ PASS' : '❌ FAIL'
        md += `| ${si + 1} | ${step.message_sent} | ${step.bot_response?.replace(/\n/g, ' ').substring(0, 80)} | ${kw} | ${pass} |\n`
      })
      md += '\n'
    })

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-report-${result.category_name}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredCategories = selectedCat === 'all' ? categories : categories.filter(c => c.id === selectedCat)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Test Results</h1>
        <p className="text-gray-500 mt-1">รันการทดสอบและดูสรุปผลการสนทนากับ bot</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCat('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCat === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          ทั้งหมด
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCat === cat.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {categories.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">ยังไม่มี category กรุณาสร้าง category ก่อน</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map(cat => {
            const catResults = results.filter(r => r.category_id === cat.id)
            const isRunning = running[cat.id]
            const catLogs = logs[cat.id] || []

            return (
              <div key={cat.id} className="card">
                {/* Category header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{cat.name}</h2>
                    <p className="text-sm text-gray-500">
                      {cat.scenarios?.length || 0} scenarios · ทดสอบซ้ำ {cat.repeat_count || 1} ครั้ง
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {catResults.length > 0 && (
                      <button onClick={() => clearResults(cat.id)} className="btn-secondary text-sm">
                        ล้างผล
                      </button>
                    )}
                    {isRunning ? (
                      <button onClick={() => stopTest(cat.id)} className="btn-danger text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        หยุด
                      </button>
                    ) : (
                      <button
                        onClick={() => runTest(cat.id)}
                        disabled={!cat.scenarios?.length}
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        รันการทดสอบ
                      </button>
                    )}
                  </div>
                </div>

                {/* Live log */}
                {isRunning && catLogs.length > 0 && (
                  <div className="mb-4 bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {catLogs.map((log, i) => (
                      <p key={i} className="text-xs font-mono text-green-400 leading-relaxed">{log}</p>
                    ))}
                  </div>
                )}

                {isRunning && catLogs.length === 0 && (
                  <div className="mb-4 flex items-center gap-3 py-3 px-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                    <span className="text-sm text-yellow-800">กำลังเริ่มต้น browser และโหลด widget...</span>
                  </div>
                )}

                {!isRunning && catLogs.length > 0 && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Log ล่าสุด</p>
                    <p className="text-xs text-red-700 font-mono break-words">
                      {catLogs[catLogs.length - 1]}
                    </p>
                  </div>
                )}

                {/* Results */}
                {catResults.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">ผลการทดสอบล่าสุด</h3>
                    <div className="space-y-2">
                      {catResults.slice().reverse().map(result => {
                        const passCount = result.scenarios?.filter(s => s.status === 'pass').length || 0
                        const total = result.scenarios?.length || 0
                        const isExpanded = expandedResults[result.id]

                        return (
                          <div key={result.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleExpand(result.id)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <StatusBadge status={result.status} />
                                <span className="text-sm text-gray-700">
                                  {new Date(result.started_at).toLocaleString('th-TH')}
                                </span>
                                <span className="text-sm text-gray-500">
                                  ({passCount}/{total} scenarios passed)
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={e => { e.stopPropagation(); exportMarkdown(result) }}
                                  className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50"
                                >
                                  Export .md
                                </button>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                                {result.scenarios?.map((scen, si) => (
                                  <div key={si} className="mb-4 last:mb-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <StatusBadge status={scen.status} />
                                      <span className="text-sm font-medium text-gray-800">{scen.scenario_name}</span>
                                      {scen.run_index !== undefined && (
                                        <span className="text-xs text-gray-400">Run #{scen.run_index + 1}</span>
                                      )}
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="border border-gray-200 px-2 py-1.5 text-left text-gray-600">#</th>
                                            <th className="border border-gray-200 px-2 py-1.5 text-left text-gray-600">ข้อความที่ส่ง</th>
                                            <th className="border border-gray-200 px-2 py-1.5 text-left text-gray-600">Bot Response</th>
                                            <th className="border border-gray-200 px-2 py-1.5 text-left text-gray-600">Keywords</th>
                                            <th className="border border-gray-200 px-2 py-1.5 text-center text-gray-600">ผล</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {scen.steps?.map((step, si2) => (
                                            <tr key={si2} className={si2 % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                              <td className="border border-gray-200 px-2 py-2 text-gray-500">{si2 + 1}</td>
                                              <td className="border border-gray-200 px-2 py-2 font-medium text-gray-800">{step.message_sent}</td>
                                              <td className="border border-gray-200 px-2 py-2 text-gray-600 max-w-xs">
                                                <div className="max-h-16 overflow-y-auto">{step.bot_response || '(ไม่มี response)'}</div>
                                              </td>
                                              <td className="border border-gray-200 px-2 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                  {step.expected_keywords?.map((kw, ki) => (
                                                    <span key={ki} className={`px-1.5 py-0.5 rounded text-xs font-medium ${step.matched_keywords?.includes(kw) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                      {kw}
                                                    </span>
                                                  ))}
                                                  {!step.expected_keywords?.length && <span className="text-gray-400 italic">-</span>}
                                                </div>
                                              </td>
                                              <td className="border border-gray-200 px-2 py-2 text-center">
                                                <StatusBadge status={step.passed ? 'pass' : 'fail'} />
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {catResults.length === 0 && !isRunning && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีผลการทดสอบ กด "รันการทดสอบ" เพื่อเริ่ม</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
