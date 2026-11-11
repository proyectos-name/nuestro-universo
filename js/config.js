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
    placeholder: 'DD / MM / AAAA',
    buttonText: 'Abrir portal',
    errorEmpty: 'Escribe nuestra fecha especial para continuar.',
    errorIncomplete: 'Completa el día, mes y año para abrir nuestro portal.',
    errorInvalid: 'Esa fecha aún no abre nuestro portal... intenta con nuestro día especial.'
  },

  // Textos de la pantalla de Bienvenida
  welcome: {
    badge: 'CONEXIÓN ESTABLECIDA',
    title: 'Bienvenida a nuestro universo',
    message:
      'A veces hay canciones que dicen mucho sin necesidad de explicar demasiado. Esta me hizo pensar en ti y en lo bonito que es coincidir con alguien que se vuelve especial en tu vida. 🤍',
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
    dedication:
      '“Hay personas que llegan sin hacer ruido y terminan volviéndose un lugar bonito en la vida.”',
    letterParagraphs: [
      'Gracias por ser esa persona especial cuya presencia hace que los días simples se sientan mucho más ligeros y bonitos.',
      'No hacen falta grandes discursos para agradecer lo valioso que es coincidir contigo, compartir buenos momentos y saber que hay alguien sincero ahí.',
      'Ojalá la vida te regale siempre motivos para sonreír, calma en los días complicados y momentos tan bonitos como los que tú sabes dejar.'
    ],
    signature: 'Con mucho cariño 🤍',
    replaySongText: 'Volver a escuchar la canción',
    restartExperienceText: 'Reiniciar experiencia'
  }
};
