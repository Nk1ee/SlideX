import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { userRequestSchema } from '../src/presentation/schema.js';

type Session = Record<string, unknown>;
type FsmOutput = {
  chatId: number;
  updateFields: Session;
  replyText: string;
  replyMarkup: unknown;
  isReady: boolean;
  presentationRequest: null | {
    topic: string;
    subject: string;
    slideCount: number;
    studentName: string;
    group: string;
    educationContext:
      | { educationStage: 'school'; schoolClass: string }
      | { educationStage: 'college' | 'university'; course: string };
  };
};

const codePath = resolve('integrations/n8n/fsm-engine.education-context.js');

async function runFsm(state: string, text: string, session: Session = {}): Promise<FsmOutput> {
  const code = await readFile(codePath, 'utf8');
  const nodes: Record<string, { item: { json: unknown } }> = {
    'Telegram Trigger': { item: { json: { message: { chat: { id: 42 }, text } } } },
    'Get a row': { item: { json: { ...session, state } } },
  };
  const nodeAccessor = (name: string): { item: { json: unknown } } => {
    const node = nodes[name];
    if (!node) throw new Error(`Unknown test node: ${name}`);
    return node;
  };
  const execute = new Function('$', code) as (accessor: typeof nodeAccessor) => Array<{ json: FsmOutput }>;
  return execute(nodeAccessor)[0]!.json;
}

test('education stage branches to school class or higher-education course', async () => {
  const school = await runFsm('waiting_education_stage', 'Школа');
  assert.deepEqual(school.updateFields, { education_stage: 'school', state: 'waiting_school_class' });
  assert.match(school.replyText, /класс/i);

  const college = await runFsm('waiting_education_stage', 'Колледж');
  assert.deepEqual(college.updateFields, { education_stage: 'college', state: 'waiting_course' });
  assert.match(college.replyText, /курс/i);

  const university = await runFsm('waiting_education_stage', 'Вуз');
  assert.deepEqual(university.updateFields, { education_stage: 'university', state: 'waiting_course' });
});

test('school class remains byte-for-byte user metadata and becomes trusted context', async () => {
  const classAnswer = await runFsm('waiting_school_class', ' 8Г ', { education_stage: 'school' });
  assert.deepEqual(classAnswer.updateFields, { school_class: ' 8Г ', student_group: ' 8Г ', state: 'waiting_topic' });

  const ready = await runFsm('waiting_name', ' Ох ', {
    education_stage: 'school', school_class: ' 8Г ', student_group: ' 8Г ',
    topic: 'Тема', subject: 'Информатик', slide_count: 13,
  });
  assert.equal(ready.isReady, true);
  assert.equal(ready.presentationRequest?.studentName, ' Ох ');
  assert.equal(ready.presentationRequest?.group, ' 8Г ');
  assert.deepEqual(ready.presentationRequest?.educationContext, { educationStage: 'school', schoolClass: ' 8Г ' });
  assert.doesNotThrow(() => userRequestSchema.parse(ready.presentationRequest));
});

test('university path preserves course and group separately', async () => {
  const course = await runFsm('waiting_course', ' 4 ', { education_stage: 'university' });
  assert.deepEqual(course.updateFields, { course: ' 4 ', state: 'waiting_group' });

  const group = await runFsm('waiting_group', ' ИС-21 ', { education_stage: 'university', course: ' 4 ' });
  assert.deepEqual(group.updateFields, { student_group: ' ИС-21 ', state: 'waiting_topic' });

  const ready = await runFsm('waiting_name', 'Иван Иванов', {
    education_stage: 'university', course: ' 4 ', student_group: ' ИС-21 ',
    topic: 'Тема', subject: 'История', slide_count: 10,
  });
  assert.deepEqual(ready.presentationRequest?.educationContext, { educationStage: 'university', course: ' 4 ' });
  assert.equal(ready.presentationRequest?.group, ' ИС-21 ');
  assert.doesNotThrow(() => userRequestSchema.parse(ready.presentationRequest));
});

test('invalid stage and slide count keep the current state without silent defaults', async () => {
  const stage = await runFsm('waiting_education_stage', 'Работа');
  assert.deepEqual(stage.updateFields, {});
  assert.equal(stage.isReady, false);
  assert.match(stage.replyText, /школа, колледж или вуз/i);

  const count = await runFsm('waiting_slide_count', '10 слайдов', { education_stage: 'school' });
  assert.deepEqual(count.updateFields, {});
  assert.equal(count.presentationRequest, null);
  assert.match(count.replyText, /целое положительное число/i);
});
