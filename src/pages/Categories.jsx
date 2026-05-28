import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../api'
import Modal from '../components/Modal'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', repeat_count: 1 })
  const navigate = useNavigate()

  const load = () => {
    categoriesApi.list().then(r => {
      setCategories(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', repeat_count: 1 })
    setShowModal(true)
  }

  const openEdit = (cat, e) => {
    e.stopPropagation()
    setEditing(cat)
    setForm({ name: cat.name, repeat_count: cat.repeat_count })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editing) {
      await categoriesApi.update(editing.id, form)
    } else {
      await categoriesApi.create(form)
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (cat, e) => {
    e.stopPropagation()
    if (!confirm(`ลบ category "${cat.name}" และ scenarios ทั้งหมด?`)) return
    await categoriesApi.remove(cat.id)
    load()
  }

  const updateRepeat = async (cat, delta, e) => {
    e.stopPropagation()
    const newCount = Math.max(1, (cat.repeat_count || 1) + delta)
    await categoriesApi.update(cat.id, { ...cat, repeat_count: newCount })
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Categories</h1>
          <p className="text-gray-500 mt-1">จัดการ categories และ scenarios สำหรับการทดสอบ</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          สร้าง Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มี Category</h3>
          <p className="text-gray-500 mb-6">สร้าง category แรกเพื่อเริ่มต้นการทดสอบ</p>
          <button onClick={openCreate} className="btn-primary">สร้าง Category แรก</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => navigate(`/categories/${cat.id}`)}
              className="card cursor-pointer hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{cat.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cat.scenarios?.length || 0} scenario{(cat.scenarios?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={e => openEdit(cat, e)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={e => handleDelete(cat, e)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ทดสอบซ้ำ</span>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => updateRepeat(cat, -1, e)}
                      className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold transition-colors"
                    >−</button>
                    <span className="w-8 text-center font-semibold text-gray-900 text-sm">{cat.repeat_count || 1}</span>
                    <button
                      onClick={e => updateRepeat(cat, 1, e)}
                      className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold transition-colors"
                    >+</button>
                    <span className="text-sm text-gray-500">ครั้ง</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-xs text-primary-600 font-medium group-hover:underline">
                  คลิกเพื่อจัดการ scenarios →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไข Category' : 'สร้าง Category ใหม่'}>
        <div className="space-y-4">
          <div>
            <label className="label">ชื่อ Category <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              placeholder="เช่น Greeting Test, Product FAQ"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">จำนวนครั้งที่ทดสอบซ้ำ</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm(f => ({ ...f, repeat_count: Math.max(1, f.repeat_count - 1) }))}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
              >−</button>
              <input
                type="number"
                min="1"
                max="20"
                className="input w-20 text-center"
                value={form.repeat_count}
                onChange={e => setForm(f => ({ ...f, repeat_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <button
                onClick={() => setForm(f => ({ ...f, repeat_count: f.repeat_count + 1 }))}
                className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold"
              >+</button>
              <span className="text-sm text-gray-500">ครั้ง</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={!form.name.trim()} className="btn-primary flex-1">
              {editing ? 'บันทึกการแก้ไข' : 'สร้าง Category'}
            </button>
            <button onClick={() => setShowModal(false)} className="btn-secondary">ยกเลิก</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
