export function getUserProfile() {
  return {
    name: localStorage.getItem('ctx_user_name') || '',
    role: localStorage.getItem('ctx_user_role') || '',
  }
}

export function saveUserProfile({ name, role }) {
  if (name !== undefined) localStorage.setItem('ctx_user_name', name)
  if (role !== undefined) localStorage.setItem('ctx_user_role', role)
}

export function getTheme() {
  return localStorage.getItem('ctx_theme') || 'system'
}

export function applyTheme(theme) {
  localStorage.setItem('ctx_theme', theme)
  const html = document.documentElement
  html.classList.remove('theme-dark', 'theme-light')
  if (theme === 'dark') html.classList.add('theme-dark')
  else if (theme === 'light') html.classList.add('theme-light')
}
