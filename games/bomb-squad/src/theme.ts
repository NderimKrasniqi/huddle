/**
 * Bomb Squad's own colours. Games keep their theme local and never read the
 * platform's design tokens; `tools/validate-architecture.py` lists these hexes.
 */
export const bomb = {
  night: '#1B1530',
  panel: '#2A2147',
  panelEdge: '#4A3D78',
  cream: '#FFF6E5',
  muted: '#A99BC6',
  bodyLight: '#6B4FA3',
  rope: '#E8D3B0',
  ropeBurnt: '#5A4A3A',
  hazard: '#FFC83D',
  spark: '#FF8A3D',
  danger: '#FF5A5F',
  safe: '#3BB273',
  wireRed: '#E5484D',
  wireBlue: '#4C7BF3',
  wireYellow: '#F6C445',
  wireGreen: '#3BB273',
} as const;

export const FONT = {
  regular: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  black: 'Nunito_900Black',
} as const;
