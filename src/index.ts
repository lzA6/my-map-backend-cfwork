import { Router, IRequest } from 'itty-router';
import adminHtml from './admin.html'; // 导入 HTML 文件作为文本

// 定义 Cloudflare Worker 的环境类型，包含 D1 数据库绑定
export interface Env {
	DB: D1Database;
}

// 定义兴趣点（Point of Interest）的数据结构
// 这解决了 TypeScript 的类型错误，让代码更健壮
interface Point {
	id?: number;
	name: string;
	latitude: number;
	longitude: number;
	category: string;
	description?: string;
}

const router = Router();

// 根路由：提供管理后台页面
router.get('/', () => {
	return new Response(adminHtml, {
		headers: { 'Content-Type': 'text/html;charset=utf-8' },
	});
});

// API 路由：获取所有兴趣点
router.get('/api/points', async (request: IRequest, env: Env) => {
	try {
		const { results } = await env.DB.prepare(
			'SELECT * FROM PointsOfInterest ORDER BY createdAt DESC'
		).all<Point>();
		return new Response(JSON.stringify(results), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		console.error(e);
		return new Response(JSON.stringify({ error: e.message }), { status: 500 });
	}
});

// API 路由：添加一个新的兴趣点
router.post('/api/points', async (request: IRequest, env: Env) => {
	try {
		// 明确告知 TypeScript request.json() 的返回类型是 Point
		const point: Point = await request.json();

		// 服务端验证
		if (!point.name || !point.latitude || !point.longitude || !point.category) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		const { success } = await env.DB.prepare(
			'INSERT INTO PointsOfInterest (name, latitude, longitude, category, description) VALUES (?, ?, ?, ?, ?)'
		)
			.bind(point.name, point.latitude, point.longitude, point.category, point.description || '')
			.run();

		if (success) {
			return new Response(JSON.stringify({ message: 'Point added successfully' }), { status: 201 });
		} else {
			return new Response(JSON.stringify({ error: 'Failed to add point' }), { status: 500 });
		}
	} catch (e: any) {
		console.error(e);
		// 如果 JSON 解析失败或数据库出错
		return new Response(JSON.stringify({ error: e.message }), { status: 500 });
	}
});

// 404 处理器
router.all('*', () => new Response('404, Not Found!', { status: 404 }));

// 导出 worker
export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
		router.handle(request, env, ctx),
};
