/** Canonical NativeWind projection of Soft Minimal's semantic tokens. */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#FFF7F2',
        screen: '#FFF7F2',
        surface: '#FFFFFF',
        'room-surface': '#FDFAF9',
        soft: '#FFE9DE',
        ink: '#0F172A',
        inverse: '#FFFFFF',
        muted: '#64748B',
        border: '#E9E6E2',
        sage: '#A7B3A6',
        accent: '#FF6B4A',
        online: '#34A853',
        away: '#A0A4AA',
        'just-joined': '#2D9CDB',
        'setup-canvas': '#0B2A2D',
        'setup-text': '#FFF8EA',
        'setup-muted': '#B9E5DB',
        'setup-gold': '#F5C765'
      },
      spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 },
      borderRadius: { chip: 10, input: 14, button: 14, row: 16, card: 20, 'card-lg': 24 },
      fontFamily: {
        regular: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold']
      },
      fontSize: {
        'phone-caption': [12, 16],
        'phone-label': [13, 18],
        'phone-body': [16, 24],
        'phone-heading': [24, 32],
        'phone-title': [32, 40],
        'tv-caption': [16, 22],
        'tv-label': [18, 24],
        'tv-body': [22, 30],
        'tv-heading': [40, 48],
        'tv-display': [56, 64]
      }
    }
  }
};
