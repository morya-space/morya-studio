import { computed, ref } from 'vue'

const STORAGE_KEY = 'morya-studio-session'

export const studioAccount = {
  email: 'grealish@teamdek.com',
  password: 'studio',
  name: 'Grealish',
  plan: 'Free member',
}

export interface StudioUser {
  name: string
  email: string
  plan: string
}

function readStored(): StudioUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StudioUser>
    if (!parsed.email || !parsed.name || !parsed.plan) return null
    return { name: parsed.name, email: parsed.email, plan: parsed.plan }
  } catch {
    return null
  }
}

const user = ref<StudioUser | null>(readStored())

export function useSession() {
  const isAuthenticated = computed(() => user.value !== null)

  function login(email: string, password: string) {
    const matches = email.trim().toLowerCase() === studioAccount.email
      && password === studioAccount.password
    if (!matches) return false
    user.value = {
      name: studioAccount.name,
      email: studioAccount.email,
      plan: studioAccount.plan,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
    return true
  }

  function logout() {
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { user, isAuthenticated, login, logout }
}
