import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data)
}

export const categoriesApi = {
  list: () => api.get('/categories'),
  get: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
  addScenario: (catId, data) => api.post(`/categories/${catId}/scenarios`, data),
  updateScenario: (catId, scenId, data) => api.put(`/categories/${catId}/scenarios/${scenId}`, data),
  removeScenario: (catId, scenId) => api.delete(`/categories/${catId}/scenarios/${scenId}`)
}

export const testsApi = {
  getResults: () => api.get('/tests/results'),
  getCategoryResults: (categoryId) => api.get(`/tests/results/${categoryId}`),
  run: (categoryId) => api.post('/tests/run', { categoryId }),
  clearResults: (categoryId) => api.delete(`/tests/results/${categoryId}`)
}
