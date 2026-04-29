type BrandLogoTheme = 'brand' | 'light';
type SvgSize = number | string;

export interface LogoProps {
	theme?: BrandLogoTheme;
	primaryColor?: string;
	secondaryColor?: string;
	class?: string;
	width?: SvgSize;
	height?: SvgSize;
	title?: string;
	ariaLabel?: string;
}

interface BrandPalette {
	primary: string;
	secondary: string;
}

const BRAND_PALETTES: Record<BrandLogoTheme, BrandPalette> = {
	brand: {
		primary: '#152346',
		secondary: '#F7CB16'
	},
	light: {
		primary: '#FFFFFF',
		secondary: '#F7CB16'
	}
};

export function resolveBrandPalette(
	theme: BrandLogoTheme,
	primaryColor?: string,
	secondaryColor?: string
): BrandPalette {
	const palette = BRAND_PALETTES[theme];

	return {
		primary: primaryColor ?? palette.primary,
		secondary: secondaryColor ?? palette.secondary
	};
}
