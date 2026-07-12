/** Sidebar navigation items */
export const NAV_ITEMS = [
	{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
	{ href: '/customers', label: 'Clientes', icon: 'users' },
	{ href: '/products', label: 'Inventario', icon: 'package' },
	{ href: '/sales', label: 'Ventas', icon: 'shopping' },
	{ href: '/receivables', label: 'Cuentas por Cobrar', icon: 'receivables' },
	{ href: '/quotes', label: 'Presupuestos', icon: 'quotes' },
	{ href: '/lenses', label: 'Catálogo Lentes', icon: 'eye' },
	{ href: '/brands', label: 'Marcas', icon: 'tag' },
	{ href: '/materials', label: 'Materiales', icon: 'layers' },
	{ href: '/suppliers', label: 'Proveedores', icon: 'truck' },
	{
		href: '/inventory/count',
		label: 'Conteo Físico',
		icon: 'purchases',
		activeIcon: 'clipboard-check'
	}
] as const;
export type NavRoute = (typeof NAV_ITEMS)[number]['href'];

/** Admin/manager sidebar items */
export const ADMIN_ITEMS = [
	{ href: '/purchases', label: 'Compras', icon: 'purchases' },
	{ href: '/cash', label: 'Caja', icon: 'wallet' },
	{ href: '/reports', label: 'Reportes', icon: 'reports' }
] as const;
export type AdminRoute = (typeof ADMIN_ITEMS)[number]['href'];

/** Super admin sidebar items */
export const SUPER_ADMIN_ITEMS = [{ href: '/users', label: 'Usuarios', icon: 'shield' }] as const;
export type SuperAdminRoute = (typeof SUPER_ADMIN_ITEMS)[number]['href'];

/** Extra routes used in non-sidebar components */
export const ADDITIONAL_ROUTES = ['/quotes/new', '/customers/new'] as const;
export type AdditionalRoute = (typeof ADDITIONAL_ROUTES)[number];

/** All static routes in the app */
export type StaticRoute = NavRoute | AdminRoute | SuperAdminRoute | AdditionalRoute;
