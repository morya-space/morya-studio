/**
 * 把（可能是 Vue 响应式 Proxy 的）对象转为纯数据，供写入 Schema 使用。
 * 避免把 Proxy 混入 Schema 后导致 store 的 structuredClone 抛错。
 */
export function plain<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}
