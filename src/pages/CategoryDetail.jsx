import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { categoriesApi } from '../api'
import Modal from '../components/Modal'

const emptyStep = () => ({ message: '', expected_keywords: [] })
const emptyScenario = () => ({ name: '', steps: [emptyStep()] })

export default function CategoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingScenario, setEditingScenario] = useState(null)
  const [form, setForm] = useState(emptyScenario())
  const [keywordInputs, setKeywordInputs] = useState([''])

  const load = () => {
    categoriesApi.get(id).then(r => {
      setCategory(r.data)
      setLoading(false)
    }).catch(() => navigate('/categories'))
  }

  useEffect(() => { load() }, [id])

  const openCreate = () => {
    setEditingScenario(null)
    setForm(emptyScenario())
    setKeywordInputs([''])
    setShowModal(true)
  }

  const openEdit = (scenario) => {
    setEditingScenario(scenario)
    setForm({
      name: scenario.name,
      steps: scenario.steps.map(s => ({
        message: s.message,
        expected_keywords: [...s.expected_keywords]
      }))
    })
    setKeywordInputs(scenario.steps.map(() => ''))
    setShowModal(true)
  }

  const addStep = () => {
    setForm(f => ({ ...f, steps: [...f.steps, emptyStep()] }))
    setKeywordInputs(k => [...k, ''])
  }

  const removeStep = (idx) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))
    setKeywordInputs(k => k.filter((_, i) => i !== idx))
  }

  const updateStep = (idx, key, value) => {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, [key]: value } : s)
    }))
  }

  const addKeyword = (stepIdx) => {
    const word = (keywordInputs[stepIdx] || '').trim()
    if (!word) return
    updateStep(stepIdx, 'expected_keywords', [...form.steps[stepIdx].expected_keywords, word])
    setKeywordInputs(k => k.map((v, i) => i === stepIdx ? '' : v))
  }

  const removeKeyword = (stepIdx, kwIdx) => {
    updateStep(stepIdx, 'expected_keywords', form.steps[stepIdx].expected_keywords.filter((_, i) => i !== kwIdx))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const data = {
      name: form.name,
      steps: form.steps.map(s => ({
        message: s.message,
        expected_keywords: s.expected_keywords
      }))
    }
    if (editingScenario) {
      await categoriesApi.updateScenario(id, editingScenario.id, data)
    } else {
      await categoriesApi.addScenario(id, data)
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (scenarioId) => {
    if (!confirm('ลบ scenario นี้?')) return
    await categoriesApi.removeScenario(id, scenarioId)
    load()
  }

  const updateRepeat = async (delta) => {
    const newCount = Math.max(1, (category.repeat_count || 1) + delta)
    await categoriesApi.update(id, { ...category, repeat_count: newCount })
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <button onClick={() => navigate('/categories')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับไป Categories
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-gray-500 mt-1">{category.scenarios?.length || 0} scenarios</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl py-2.5 px-4 shadow-sm">
              <span className="text-sm text-gray-600 font-medium">ทดสอบซ้ำ</span>
              <div className="flex items-center gap-2">
                <button onClick={() => updateRepeat(-1)} className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-sm">−</button>
                <span className="w-8 text-center font-semibold text-gray-900">{category.repeat_count || 1}</span>
                <button onClick={() => updateRepeat(1)} className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-sm">+</button>
                <span className="text-sm text-gray-500">ครั้ง</span>
              </div>
            </div>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              เพิ่ม Scenario
            </button>
          </div>
        </div>
      </div>

      {!category.scenarios?.length ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มี Scenario</h3>
          <p className="text-gray-500 mb-6">เพิ่ม scenario เพื่อกำหนดขั้นตอนการสนทนาที่ต้องการทดสอบ</p>
          <button onClick={openCreate} className="btn-primary">เพิ่ม Scenario แรก</button>
        </div>
      ) : (
        <div className="space-y-4">
          {category.scenarios.map((scenario, idx) => (
            <div key={scenario.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{scenario.name}</h3>
                    <p className="text-xs text-gray-500">{scenario.steps?.length || 0} steps</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(scenario)} className="btn-secondary text-sm py-1.5 px-3">แก้ไข</button>
                  <button
                    onClick={() => handleDelete(scenario.id)}
                    className="text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm py-1.5 px-3 transition-colors"
                  >ลบ</button>
                </div>
              </div>

              <div className="space-y-2">
                {scenario.steps?.map((step, stepIdx) => (
                  <div key={step.id || stepIdx} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="text-xs text-gray-400 font-mono mt-0.5 w-8 flex-shrink-0">#{stepIdx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                        </svg>
                        <span className="text-sm text-gray-800 font-medium">{step.message}</span>
                      </div>
                      {step.expected_keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {step.expected_keywords.map((kw, ki) => (
                            <span key={ki} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingScenario ? 'แก้ไข Scenario' : 'เพิ่ม Scenario ใหม่'}
        size="lg"
      >
        <div className="space-y-5">
          <div>
            <label className="label">ชื่อ Scenario <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              placeholder="เช่น Basic Greeting, Product Inquiry"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Steps การสนทนา</label>
              <button onClick={addStep} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                เพิ่ม Step
              </button>
            </div>

            <div className="space-y-4">
              {form.steps.map((step, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Step {idx + 1}</span>
                    {form.steps.length > 1 && (
                      <button onClick={() => removeStep(idx)} className="text-red-500 hover:text-red-700 text-xs font-medium">ลบ step นี้</button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">ข้อความที่จะส่ง</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="เช่น สวัสดี"
                        value={step.message}
                        onChange={e => updateStep(idx, 'message', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Keywords ที่คาดหวังใน response (ถ้าไม่กำหนด = pass เสมอ)</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder="พิมพ์ keyword แล้วกด Enter หรือ Add"
                          value={keywordInputs[idx] || ''}
                          onChange={e => setKeywordInputs(k => k.map((v, i) => i === idx ? e.target.value : v))}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(idx))}
                        />
                        <button onClick={() => addKeyword(idx)} className="btn-secondary text-sm px-3">Add</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-6">
                        {step.expected_keywords.map((kw, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {kw}
                            <button onClick={() => removeKeyword(idx, ki)} className="hover:text-green-900 font-bold leading-none">×</button>
                          </span>
                        ))}
                        {step.expected_keywords.length === 0 && (
                          <span className="text-xs text-gray-400 italic">ไม่มี keywords</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={handleSave} disabled={!form.name.trim()} className="btn-primary flex-1">
              {editingScenario ? 'บันทึกการแก้ไข' : 'เพิ่ม Scenario'}
            </button>
            <button onClick={() => setShowModal(false)} className="btn-secondary">ยกเลิก</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
