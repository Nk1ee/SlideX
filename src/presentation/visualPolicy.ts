import type { EducationContext } from './types.js';

export type EducationStage = EducationContext['educationStage'] | 'unknown';
export type SchoolBand = 'primary' | 'middle' | 'high' | 'not_applicable' | 'unknown';
export type PresentationTask = 'explain_topic' | 'class_report' | 'project_defense' | 'research_report' | 'biography' | 'unknown';
export type SlidePurpose = 'title' | 'introduce' | 'real_object' | 'person' | 'place' | 'mechanism' | 'process' | 'structure' | 'comparison' | 'evidence' | 'chronology' | 'quote' | 'summary' | 'sources';
export type VisualFormat = 'photo' | 'illustration' | 'diagram' | 'chart' | 'timeline' | 'none';
export type SubjectFamily = 'technical' | 'natural_science' | 'history_social' | 'geography' | 'language_literature' | 'arts' | 'other';

export type LearningContext = (EducationContext | { educationStage: 'unknown' }) & { task: PresentationTask };

export type VisualPolicyInput = {
  subject: string;
  learning: LearningContext;
  slideCount: number;
  slidePurpose: SlidePurpose;
  hasSourcedNumericData: boolean;
};

export type VisualBudget = {
  contentSlides: number;
  targetRichSlides: number;
  maxRichSlides: number;
  maxChartSlides: number;
  maxSameFormatInRow: 2;
};

export type VisualRecommendation = {
  format: VisualFormat;
  subjectFamily: SubjectFamily;
  schoolBand: SchoolBand;
  reasons: string[];
};

export function schoolBandFor(context: LearningContext): SchoolBand {
  if (context.educationStage === 'unknown') return 'unknown';
  if (context.educationStage !== 'school') return 'not_applicable';
  const schoolGrade = schoolGradeFromClass(context.schoolClass);
  if (schoolGrade === null) return 'unknown';
  if (schoolGrade <= 4) return 'primary';
  if (schoolGrade <= 8) return 'middle';
  return 'high';
}

export function schoolGradeFromClass(schoolClass: string): number | null {
  const match = schoolClass.trim().match(/^(\d{1,2})/u);
  if (!match) return null;
  const grade = Number(match[1]);
  return Number.isInteger(grade) && grade >= 1 && grade <= 11 ? grade : null;
}

export function classifySubject(subject: string): SubjectFamily {
  const normalized = subject.trim().toLocaleLowerCase('ru-RU');
  if (/(информат|программ|математ|алгеб|геометр)/u.test(normalized)) return 'technical';
  if (/(физик|хими|биолог|эколог|астроном)/u.test(normalized)) return 'natural_science';
  if (/(истори|обществ|эконом|право|полит)/u.test(normalized)) return 'history_social';
  if (/(географ|краеведен)/u.test(normalized)) return 'geography';
  if (/(литератур|русск|англий|немец|француз|язык)/u.test(normalized)) return 'language_literature';
  if (/(искусств|музык|живопис|дизайн|мхк)/u.test(normalized)) return 'arts';
  return 'other';
}

export function visualBudgetFor(slideCount: number, task: PresentationTask): VisualBudget {
  if (!Number.isInteger(slideCount) || slideCount < 1) throw new Error('slideCount must be a positive integer');
  const contentSlides = Math.max(0, slideCount - 2);
  const taskWeight = task === 'research_report' || task === 'project_defense' ? 0.6 : 0.5;
  const targetRichSlides = contentSlides === 0 ? 0 : Math.max(1, Math.round(contentSlides * taskWeight));
  const maxRichSlides = Math.min(contentSlides, Math.ceil(contentSlides * 0.7));
  const maxChartSlides = contentSlides === 0 ? 0 : task === 'research_report' || task === 'project_defense'
    ? Math.max(1, Math.ceil(contentSlides * 0.3))
    : 1;
  return { contentSlides, targetRichSlides, maxRichSlides, maxChartSlides, maxSameFormatInRow: 2 };
}

/**
 * Recommend a semantic visual format. This function never creates content, queries,
 * chart values, dates or sources. Gemini still plans meaning; validators enforce data.
 */
export function recommendVisualFormat(input: VisualPolicyInput): VisualRecommendation {
  const subjectFamily = classifySubject(input.subject);
  const schoolBand = schoolBandFor(input.learning);
  const reasons: string[] = [];
  const fixedNone: SlidePurpose[] = ['title', 'quote', 'summary', 'sources'];
  if (fixedNone.includes(input.slidePurpose)) {
    return { format: 'none', subjectFamily, schoolBand, reasons: ['slide_role_does_not_need_external_visual'] };
  }
  if (input.slidePurpose === 'evidence' || input.slidePurpose === 'comparison') {
    if (input.hasSourcedNumericData) return { format: 'chart', subjectFamily, schoolBand, reasons: ['sourced_numeric_evidence'] };
    reasons.push('chart_forbidden_without_sourced_numeric_data');
  }
  if (input.slidePurpose === 'chronology') return { format: 'timeline', subjectFamily, schoolBand, reasons: ['chronological_relationship'] };
  if (['mechanism', 'process', 'structure'].includes(input.slidePurpose)) {
    return { format: 'diagram', subjectFamily, schoolBand, reasons: ['relationships_are_more_important_than_appearance'] };
  }
  if (['person', 'place', 'real_object'].includes(input.slidePurpose)) {
    return { format: 'photo', subjectFamily, schoolBand, reasons: ['real_entity_benefits_from_documentary_visual'] };
  }
  if (input.learning.task === 'biography' && input.slidePurpose === 'introduce') {
    return { format: 'photo', subjectFamily, schoolBand, reasons: ['biography_needs_documentary_identity'] };
  }
  if ((input.learning.task === 'research_report' || input.learning.task === 'project_defense') && input.slidePurpose === 'introduce') {
    return { format: 'diagram', subjectFamily, schoolBand, reasons: ['analytical_task_needs_conceptual_model'] };
  }
  if (schoolBand === 'primary' && ['introduce', 'comparison'].includes(input.slidePurpose)) {
    return { format: 'illustration', subjectFamily, schoolBand, reasons: [...reasons, 'primary_school_needs_concrete_support'] };
  }
  if (subjectFamily === 'natural_science' || subjectFamily === 'technical') {
    return { format: 'diagram', subjectFamily, schoolBand, reasons: [...reasons, 'subject_prefers_explanatory_structure'] };
  }
  if (subjectFamily === 'history_social' || subjectFamily === 'geography' || subjectFamily === 'arts') {
    return { format: 'photo', subjectFamily, schoolBand, reasons: [...reasons, 'subject_benefits_from_documentary_context'] };
  }
  return { format: 'none', subjectFamily, schoolBand, reasons: [...reasons, 'no_semantically_necessary_visual'] };
}
