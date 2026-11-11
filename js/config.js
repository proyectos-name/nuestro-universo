/**
 * Configuración principal de la experiencia romántica.
 * Puedes editar fácilmente los textos, títulos y la carta final desde este archivo.
 */
export const APP_CONFIG = {
  // Fecha exacta requerida para ingresar (formato DD.MM.AAAA)
  accessCode: '18.01.2005',

  // Textos de la pantalla de Login
  login: {
    badge: 'PORTAL DEL MULTIVERSO',
    title: 'Nuestro Universo',
    subtitle: 'Ingresa nuestra fecha especial para abrir el portal hacia nuestra historia.',
    placeholder: 'DD.MM.AAAA',
    buttonText: 'Abrir portal',
    errorEmpty: 'Escribe nuestra fecha especial para continuar.',
    errorInvalid: 'Esa fecha aún no abre nuestro portal... intenta con nuestro día especial.'
  },

  // Textos de la pantalla de Bienvenida
  welcome: {
    badge: 'CONEXIÓN ESTABLECIDA',
    title: 'Bienvenida a nuestro universo',
    message:
      'Entre infinitas galaxias y líneas temporales, mi lugar favorito siempre será el mismo: a tu lado. Ponte cómoda, sube el volumen y deja que esta canción hable por mí.',
    buttonText: 'Escuchar nuestra canción'
  },

  // Datos del reproductor musical (si el .lrc trae [ti:] o [ar:], se usarán automáticamente si están presentes)
  music: {
    defaultTitle: 'Te quiero tanto',
    defaultArtist: 'Kevin Kaarl',
    nextSceneLabel: 'Ir al mensaje final',
    defaultSyncOffsetMs: 0
  },

  // Dedicatoria y carta final editable fácilmente
  finale: {
    badge: 'CAPÍTULO FINAL',
    title: 'Mi pandita 🐼',
    dedication: '“Mi pandita, en este universo y en cualquier otro, siempre te elegiría a ti.”',
    letterParagraphs: [
      'Gracias por existir en mi vida y por convertir los momentos simples en recuerdos que brillan como estrellas.',
      'Si tuviera que recorrer mil universos distintos, en todos buscaría tu sonrisa, tu abrazo y esa paz tan tuya que lo ilumina todo.',
      'Esta pequeña historia es solo una forma de recordarte cuánto te quiero hoy, mañana y en cada línea del tiempo que nos quede por vivir.'
    ],
    signature: 'Con todo mi amor, siempre tuyo ♥',
    replaySongText: 'Volver a escuchar la canción',
    restartExperienceText: 'Reiniciar experiencia'
  }
};
