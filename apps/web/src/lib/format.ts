export function formatDateTime(value?: string | null) {
  if (!value)
    return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function summarizeUserAgent(value?: string | null) {
  if (!value)
    return '未知设备'
  if (/Edg\//.test(value))
    return 'Edge'
  if (/Chrome\//.test(value))
    return 'Chrome'
  if (/Firefox\//.test(value))
    return 'Firefox'
  if (/Safari\//.test(value))
    return 'Safari'
  return '其他浏览器'
}
