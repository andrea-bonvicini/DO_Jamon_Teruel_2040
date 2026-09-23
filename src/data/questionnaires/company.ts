import type { Questionnaire } from '../types'

/**
 * Transcribed from `3_Encuesta_Empresas_DO_Jamon_Teruel.docx`
 * ("ENCUESTA A EMPRESAS — Censo del sector", versión 2.0 del documento fuente).
 *
 * The document's internal "→ Qué buscamos" notes are deliberately NOT
 * transcribed: the source states they are internal and do not appear in the
 * version that is sent out.
 *
 * The questionnaire has no conditional logic — every question is asked of
 * every respondent.
 */
export const COMPANY_QUESTIONNAIRE: Questionnaire = {
  id: 'company',
  name: 'Encuesta a empresas del sector',
  description:
    'Unas preguntas sobre su actividad, su rentabilidad y su visión del sector hasta 2040.',
  estimatedDuration: '5–8 min',
  version: 'company@1.0.0',

  sections: [
    { id: 'identificacion', order: 1, name: 'Bloque 0 · Identificación de la empresa' },
    { id: 'actividad', order: 2, name: 'Bloque 1 · Actividad y evolución' },
    { id: 'rentabilidad', order: 3, name: 'Bloque 2 · Rentabilidad y viabilidad' },
    { id: 'relevo', order: 4, name: 'Bloque 3 · Relevo generacional' },
    { id: 'sostenibilidad', order: 5, name: 'Bloque 4 · Sostenibilidad y bienestar' },
    { id: 'valoracion-do', order: 6, name: 'Bloque 5 · Valoración de la D.O.' },
    { id: 'horizonte', order: 7, name: 'Bloque 6 · Horizonte 2040' },
  ],

  questions: [
    // ─── Bloque 0 · Identificación de la empresa ───────────────────────────
    {
      id: 'C-Q01',
      sectionId: 'identificacion',
      label: 'Tipo de actividad',
      text: 'Tipo de actividad principal',
      help: 'Marque una.',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'ganadera', text: 'Explotación ganadera', icon: 'ganaderia' },
        { id: 'matadero', text: 'Matadero', icon: 'matadero' },
        { id: 'secadero', text: 'Secadero / industria elaboradora', icon: 'secadero' },
        { id: 'mixta', text: 'Actividad mixta', icon: 'mixta' },
        { id: 'otra', text: 'Otra', icon: 'otra' },
      ],
    },
    {
      id: 'C-Q02',
      sectionId: 'identificacion',
      label: 'Personas empleadas',
      text: 'Número de personas empleadas',
      type: 'single_choice',
      required: true,
      options: [
        { id: '1-5', text: '1–5' },
        { id: '6-20', text: '6–20' },
        { id: '21-50', text: '21–50' },
        { id: 'mas-50', text: 'Más de 50' },
      ],
    },
    {
      id: 'C-Q03',
      sectionId: 'identificacion',
      label: 'Años de actividad',
      text: 'Años de actividad',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'menos-10', text: 'Menos de 10' },
        { id: '10-25', text: '10–25' },
        { id: 'mas-25', text: 'Más de 25' },
      ],
    },
    {
      id: 'C-Q04',
      sectionId: 'identificacion',
      label: 'Actividad vinculada a la D.O.',
      text: '¿Qué porcentaje de su actividad está vinculada a la D.O. Jamón de Teruel?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'menos-25', text: 'Menos del 25 %' },
        { id: '25-50', text: '25–50 %' },
        { id: '51-75', text: '51–75 %' },
        { id: 'mas-75', text: 'Más del 75 %' },
      ],
    },
    {
      id: 'C-Q05',
      sectionId: 'identificacion',
      label: 'Mercados',
      text: '¿A qué mercados vende?',
      help: 'Puede marcar varias respuestas.',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      options: [
        { id: 'local', text: 'Local/provincial' },
        { id: 'aragon', text: 'Resto de Aragón' },
        { id: 'espana', text: 'Resto de España' },
        { id: 'exportacion', text: 'Exportación' },
      ],
    },

    // ─── Bloque 1 · Actividad y evolución ──────────────────────────────────
    {
      id: 'C-Q06',
      sectionId: 'actividad',
      label: 'Evolución últimos 3 años',
      text: '¿Cómo ha evolucionado su volumen de actividad en los últimos 3 años?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'crecido', text: 'Ha crecido' },
        { id: 'mantenido', text: 'Se ha mantenido' },
        { id: 'disminuido', text: 'Ha disminuido' },
      ],
    },
    {
      id: 'C-Q07',
      sectionId: 'actividad',
      label: 'Expectativa próximos 5 años',
      text: '¿Cómo espera que evolucione en los próximos 5 años?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'crecera', text: 'Crecerá' },
        { id: 'mantendra', text: 'Se mantendrá' },
        { id: 'disminuira', text: 'Disminuirá' },
        { id: 'no-lo-se', text: 'No lo sé' },
      ],
    },
    {
      id: 'C-Q08',
      sectionId: 'actividad',
      label: 'Principales limitantes',
      text: '¿Cuáles son hoy sus principales limitantes?',
      help: 'Máximo 3.',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      maxSelections: 3,
      options: [
        { id: 'precio', text: 'Precio de venta / rentabilidad' },
        { id: 'piensos', text: 'Coste de piensos o materia prima' },
        { id: 'energia', text: 'Costes energéticos' },
        { id: 'mano-obra', text: 'Mano de obra / relevo' },
        { id: 'normativa', text: 'Carga normativa' },
        { id: 'sanidad', text: 'Sanidad animal' },
        { id: 'producto-do', text: 'Disponibilidad de producto que cumpla D.O.' },
        { id: 'comercializacion', text: 'Comercialización / acceso a mercado' },
      ],
    },

    // ─── Bloque 2 · Rentabilidad y viabilidad ──────────────────────────────
    {
      id: 'C-Q09',
      sectionId: 'rentabilidad',
      label: 'Rentabilidad actual',
      text: '¿Cómo valora la rentabilidad actual de su actividad?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'buena', text: 'Buena' },
        { id: 'ajustada', text: 'Ajustada pero viable' },
        { id: 'insuficiente', text: 'Insuficiente' },
      ],
    },
    {
      id: 'C-Q10',
      sectionId: 'rentabilidad',
      label: 'La D.O. mejora el precio',
      text: '¿La D.O. mejora el precio de venta frente al producto sin sello?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'si-clara', text: 'Sí, de forma clara' },
        { id: 'ligeramente', text: 'Ligeramente' },
        { id: 'sin-diferencia', text: 'No aprecio diferencia' },
        { id: 'no-lo-se', text: 'No lo sé' },
      ],
    },

    // ─── Bloque 3 · Relevo generacional ────────────────────────────────────
    {
      id: 'C-Q11',
      sectionId: 'relevo',
      label: 'Relevo asegurado',
      text: '¿Tiene asegurado el relevo generacional en su empresa?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'si', text: 'Sí' },
        { id: 'no', text: 'No' },
        { id: 'no-aplica', text: 'No aplica' },
      ],
    },
    {
      id: 'C-Q12',
      sectionId: 'relevo',
      label: 'Recomendaría a un joven',
      text: '¿Recomendaría a una persona joven incorporarse a esta actividad?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'si', text: 'Sí' },
        { id: 'reservas', text: 'Con reservas' },
        { id: 'no', text: 'No' },
      ],
    },

    // ─── Bloque 4 · Sostenibilidad y bienestar ─────────────────────────────
    {
      id: 'C-Q13',
      sectionId: 'sostenibilidad',
      label: 'Prácticas aplicadas',
      text: '¿Cuáles de estas prácticas aplica?',
      help: 'Puede marcar varias respuestas.',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      options: [
        { id: 'bienestar', text: 'Bienestar animal por encima del mínimo legal' },
        { id: 'purines', text: 'Gestión/valorización de purines' },
        { id: 'energia', text: 'Eficiencia energética o renovables' },
        { id: 'agua', text: 'Medición de consumo de agua' },
        { id: 'huella', text: 'Medición de huella de carbono' },
        { id: 'ninguna', text: 'Ninguna de forma sistemática' },
      ],
    },
    {
      id: 'C-Q14',
      sectionId: 'sostenibilidad',
      label: 'El mercado paga la sostenibilidad',
      text: '¿Cree que el mercado paga la sostenibilidad y el bienestar animal?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'si', text: 'Sí' },
        { id: 'nichos', text: 'Solo en algunos nichos' },
        { id: 'no', text: 'No' },
      ],
    },

    // ─── Bloque 5 · Valoración de la D.O. ──────────────────────────────────
    {
      id: 'C-Q15',
      sectionId: 'valoracion-do',
      label: 'Valoración de la D.O.',
      // Wording taken verbatim from the source document's block heading.
      text: 'Valore de 1 (nada de acuerdo) a 5 (totalmente de acuerdo)',
      type: 'scale_grid',
      required: true,
      min: 1,
      max: 5,
      minLabel: 'Nada de acuerdo',
      maxLabel: 'Totalmente de acuerdo',
      rows: [
        { id: 'aporta-valor', text: 'La D.O. aporta valor a mi negocio' },
        { id: 'controles', text: 'Los controles/exigencias son razonables' },
        { id: 'ayuda-vender', text: 'La D.O. me ayuda a vender' },
        { id: 'defiende', text: 'La D.O. defiende bien mis intereses' },
        { id: 'comunicacion', text: 'Estoy satisfecho con la comunicación de la D.O.' },
      ],
    },

    // ─── Bloque 6 · Horizonte 2040 ─────────────────────────────────────────
    {
      id: 'C-Q16',
      sectionId: 'horizonte',
      label: 'Amenazas 2040',
      text: 'De cara a 2040, señale las 3 AMENAZAS que más le preocupan',
      help: 'Máximo 3.',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      maxSelections: 3,
      options: [
        { id: 'clima', text: 'Cambio climático / sequía' },
        { id: 'costes', text: 'Coste de piensos y energía' },
        { id: 'relevo', text: 'Falta de relevo' },
        { id: 'sanidad', text: 'Sanidad animal (p. ej. PPA)' },
        { id: 'competencia', text: 'Competencia (ibérico, importados, genéricos)' },
        { id: 'consumo', text: 'Caída del consumo de curados' },
        { id: 'regulacion', text: 'Cambios regulatorios' },
        { id: 'distribucion', text: 'Concentración de la distribución' },
      ],
    },
    {
      id: 'C-Q17',
      sectionId: 'horizonte',
      label: 'Oportunidades 2040',
      text: 'De cara a 2040, señale las 3 OPORTUNIDADES con más potencial',
      help: 'Máximo 3.',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      maxSelections: 3,
      options: [
        { id: 'exportacion', text: 'Exportación' },
        { id: 'online', text: 'Venta online / directa' },
        { id: 'sostenibilidad', text: 'Sostenibilidad como ventaja' },
        { id: 'turismo', text: 'Turismo gastronómico' },
        { id: 'formatos', text: 'Nuevos formatos de producto' },
        { id: 'bienestar', text: 'Bienestar animal como valor' },
        { id: 'marca-territorio', text: 'Marca-territorio' },
        { id: 'innovacion', text: 'Innovación en proceso' },
      ],
    },
  ],

  // Bloque 7 · Abierta (opcional) — pregunta 17 del documento fuente.
  openQuestion: {
    text: '¿Qué es lo más importante que debería hacer la D.O. para asegurar el futuro del sector?',
    placeholder: 'Opcional',
    maxLength: 2000,
  },
}
