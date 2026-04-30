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
		primary: '#F7CB16',
		secondary: '#152346'
	},
	light: {
		primary: '#F7CB16',
		secondary: '#FFFFFF'
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
