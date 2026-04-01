import axios from 'axios'

const api = axios.create()

let refreshPromise: Promise<boolean> | null = null

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config

    // If 401 and we haven't already retried, attempt a token refresh
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/auth/refresh')
          .then(() => true)
          .catch(() => false)
          .finally(() => { refreshPromise = null })
      }

      const refreshed = await refreshPromise
      if (refreshed) {
        return api(original)
      }

      // Refresh failed — redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`
      }
    }

    return Promise.reject(error)
  },
)

export default api
