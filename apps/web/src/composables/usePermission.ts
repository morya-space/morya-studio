import { computed } from 'vue'
import { useAuth } from '../services/auth'

export function usePermission() {
  const { user } = useAuth()
  const permissions = computed(() => user.value?.permissions ?? [])

  function can(code: string) {
    return permissions.value.includes(code)
  }

  function canAny(...codes: string[]) {
    return codes.some(code => permissions.value.includes(code))
  }

  return { permissions, can, canAny }
}
