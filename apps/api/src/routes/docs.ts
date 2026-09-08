import type { AppBindings } from '../types/context'
import { Hono } from 'hono'

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Wise Kit Studio API',
    version: '0.1.0',
    description: 'Wise Kit Studio 后端 API 文档',
  },
  servers: [{ url: 'http://localhost:3000', description: '本地开发环境' }],
  paths: {
    '/health': {
      get: {
        tags: ['系统'],
        summary: '健康检查',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: '服务正常',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'service'],
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'api' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/routes': {
      get: {
        tags: ['开发工具'],
        summary: '查看已注册路由',
        operationId: 'getRoutes',
        responses: {
          '200': {
            description: '已注册路由列表',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
} as const

const docsHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wise Kit Studio API Docs</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f5f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header { background: #172033; color: #fff; padding: 2.5rem max(1.25rem, calc((100% - 76rem) / 2)); }
    header h1 { margin: 0 0 .5rem; font-size: clamp(1.5rem, 3vw, 2.25rem); }
    header p { color: #b7c2d7; margin: 0; }
    main { max-width: 76rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
    .toolbar { display: flex; gap: .75rem; margin-bottom: 1.25rem; }
    input { border: 1px solid #d6ddea; border-radius: .5rem; font: inherit; padding: .7rem .85rem; width: min(100%, 28rem); }
    .endpoint { background: #fff; border: 1px solid #e1e6f0; border-radius: .75rem; margin: .75rem 0; overflow: hidden; }
    .endpoint summary { cursor: pointer; display: flex; gap: .75rem; align-items: center; list-style: none; padding: 1rem; }
    .endpoint summary::-webkit-details-marker { display: none; }
    .method { border-radius: .35rem; color: #fff; font-size: .75rem; font-weight: 800; min-width: 4.25rem; padding: .3rem .5rem; text-align: center; }
    .get { background: #16866a; } .post { background: #bd7a10; } .put { background: #466bc1; } .delete { background: #c44b58; }
    code { color: #25314a; font-size: .95rem; } .summary { color: #66738a; margin-left: auto; }
    .details { border-top: 1px solid #e8ebf2; padding: 1rem; } .details button { background: #2563eb; border: 0; border-radius: .4rem; color: #fff; cursor: pointer; padding: .55rem .8rem; }
    pre { background: #172033; border-radius: .5rem; color: #dbe5f7; max-height: 24rem; overflow: auto; padding: 1rem; white-space: pre-wrap; }
    .empty { color: #66738a; padding: 2rem 0; }
  </style>
</head>
<body>
  <header><h1>Wise Kit Studio API</h1><p>OpenAPI 3.0.3 · 本地开发文档</p></header>
  <main><div class="toolbar"><input id="search" placeholder="搜索接口、方法或说明" aria-label="搜索接口"></div><section id="endpoints" aria-live="polite"></section></main>
  <script>
    const data = ${JSON.stringify(openApiDocument)};
    const endpointRoot = document.querySelector('#endpoints');
    const search = document.querySelector('#search');
    const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function render() {
      const query = search.value.trim().toLowerCase();
      const items = Object.entries(data.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method, operation })));
      const visible = items.filter(({ path, method, operation }) => [path, method, operation.summary, ...(operation.tags || [])].join(' ').toLowerCase().includes(query));
      endpointRoot.innerHTML = visible.length ? visible.map(({ path, method, operation }, index) => '<details class="endpoint" ' + (index === 0 ? 'open' : '') + '><summary><span class="method ' + esc(method) + '">' + esc(method.toUpperCase()) + '</span><code>' + esc(path) + '</code><span class="summary">' + esc(operation.summary || '') + '</span></summary><div class="details"><p>' + esc((operation.tags || []).join(' · ')) + '</p><button data-path="' + esc(path) + '" data-method="' + esc(method) + '">Try it out</button><pre id="result-' + index + '" hidden></pre></div></details>').join('') : '<p class="empty">没有匹配的接口</p>';
      endpointRoot.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
        const result = document.querySelector('#result-' + [...endpointRoot.querySelectorAll('button')].indexOf(button));
        result.hidden = false; result.textContent = 'Loading...';
        try { const response = await fetch(button.dataset.path); result.textContent = response.status + '\\n\\n' + JSON.stringify(await response.json(), null, 2); }
        catch (error) { result.textContent = String(error); }
      }));
    }
    search.addEventListener('input', render); render();
  </script>
</body>
</html>`

export function createDocsRoutes() {
  const router = new Hono<AppBindings>()
  router.get('/openapi.json', (context) => context.json(openApiDocument))
  router.get('/docs', (context) => context.html(docsHtml))
  return router
}
