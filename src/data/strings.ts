/**
 * Every user-visible string that is not questionnaire content.
 * One language, one place — CLAUDE.md rule 9. Never inline a string in JSX.
 */
export const STRINGS = {
  brand: {
    name: 'D.O. Jamón de Teruel',
    logoAlt: 'D.O. Jamón de Teruel',
    protectedOrigin: 'Denominación de Origen Protegida',
    // Las dos marcas identifican a la organización: no son decorativas y
    // necesitan texto alternativo.
    markJamonAlt: 'Jamón de Teruel · Denominación de Origen Protegida',
    markCerdoAlt: 'Cerdo de Teruel · Indicación Geográfica Protegida',
    markCirceAlt: 'CIRCE, centro tecnológico',
  },

  actions: {
    start: 'Comenzar',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Finalizar',
    skip: 'Prefiero no responder',
    retry: 'Reintentar',
    newQuestionnaire: 'Nuevo cuestionario',
    viewHorizontal: 'Vista horizontal',
    viewVertical: 'Vista vertical',
    viewToggleLabel: 'Orientación de la pantalla',
  },

  welcome: {
    title: 'Cuestionario D.O. Jamón de Teruel',
  },

  audience: {
    title: '¿Desde dónde responde?',
    subtitle: 'Elija la opción que mejor le describa.',
    company: 'Respondo en nombre de una empresa del sector',
    individual: 'Respondo como consumidor a título personal',
  },

  identification: {
    title: 'Antes de empezar',
    subtitle: 'Necesitamos su conformidad para tratar las respuestas.',
    privacyLabel: 'He leído y acepto el tratamiento de mis respuestas.',
    // Two notices, because the two audiences are not treated alike: the
    // consumer survey is anonymous, the company census is not.
    privacyNoticeIndividual:
      'Las respuestas se recogen de forma anónima: no se solicita ni se almacena ningún dato que permita identificarle. Se tratarán de forma agregada con fines de estudio del sector, conforme al Reglamento (UE) 2016/679 (RGPD).',
    privacyNoticeCompany:
      'Se registra el nombre de la empresa para poder depurar el censo del sector y evitar duplicados. Las respuestas se tratarán de forma confidencial y se publicarán únicamente de forma agregada, sin identificar a ninguna empresa. No se recogen datos personales de la persona que responde. Tratamiento conforme al Reglamento (UE) 2016/679 (RGPD).',
    privacyRequired: 'Debe aceptar el tratamiento de las respuestas para continuar.',
  },

  question: {
    progress: 'Pregunta {current} de {total}',
    optional: 'Opcional',
    selectOne: 'Seleccione una opción.',
    selectAtLeast: 'Seleccione al menos {min} opción(es).',
    selectAtMost: 'Seleccione como máximo {max} opciones.',
    selectExactlyRange: 'Seleccione entre {min} y {max} opciones.',
    charactersLeft: '{count} caracteres restantes',
    outOfRange: 'Introduzca un valor entre {min} y {max}.',
    notANumber: 'Introduzca un número.',
    gridIncomplete: 'Valore todas las filas para continuar.',
    scaleLegend: 'Valoración de 1 a 5',
    selectPlaceholder: 'Seleccione…',
  },

  openAnswer: {
    title: 'Para terminar',
    progress: 'Pregunta final',
  },

  thankYou: {
    title: 'Gracias por su colaboración',
    sending: 'Guardando sus respuestas…',
    sent: 'Sus respuestas han quedado registradas.',
    // Igual que en la pantalla de identificación: a las empresas no se les
    // puede prometer anonimato, porque han dado su nombre.
    sentDetailIndividual:
      'La información se tratará de forma anónima y agregada (RGPD). Puede cerrar esta página.',
    sentDetailCompany:
      'La información se tratará de forma confidencial y se publicará de forma agregada, sin identificar a ninguna empresa (RGPD). Puede cerrar esta página.',
    errorTitle: 'No hemos podido guardar sus respuestas',
    errorDetail:
      'Sus respuestas siguen guardadas en este dispositivo. Pulse «Reintentar» cuando tenga conexión.',
  },

  qr: {
    title: 'Cuestionario D.O. Jamón de Teruel',
    subtitle: 'Escanee el código para responder.',
  },

  admin: {
    title: 'Panel de respuestas',
    checkingSession: 'Comprobando la sesión…',
    passwordLabel: 'Contraseña',
    login: 'Entrar',
    logout: 'Salir',
    wrongPassword: 'Contraseña incorrecta.',
    search: 'Buscar',
    type: 'Tipo',
    all: 'Todos',
    company: 'Empresa',
    individual: 'Consumidor',
    order: 'Ordenar por',
    date: 'Fecha',
    direction: 'Sentido',
    ascending: 'Ascendente',
    descending: 'Descendente',
    apply: 'Aplicar',
    exportWide: 'Exportar CSV (ancho)',
    exportLong: 'Exportar CSV (largo)',
    colDate: 'Fecha',
    colType: 'Tipo',
    colIdentification: 'Identificación',
    colCompanyName: 'Empresa',
    tabCompany: 'Empresas',
    tabIndividual: 'Consumidores',
    tabsLabel: 'Cuestionario',
    colVersion: 'Versión',
    colAnswers: 'Respuestas',
    empty: 'No hay respuestas que coincidan con el filtro.',
    count: '{count} respuestas',
    countOne: '1 respuesta',
    loading: 'Cargando…',
    back: 'Volver al listado',
    detailTitle: 'Respuesta',
    openAnswerHeading: 'Respuesta abierta',
    noAnswer: '—',
    unresolved: 'Valor no resuelto',
    anonymous: 'Anónima',
  },

  errors: {
    generic: 'Se ha producido un error inesperado.',
  },
} as const

/** Fills {placeholders} in a string from `STRINGS`. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
