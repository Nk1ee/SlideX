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
  replyPhotoAsset: string | null;
  isReady: boolean;
  presentationRequest: null | {
    topic: string;
    subject: string;
    slideCount: number;
    studentName: string;
    group: string;
    style: string;
    educationContext:
      | { educationStage: 'school'; schoolClass: string }
      | { educationStage: 'college' | 'university'; course: string };
  };
};

const codePath = resolve('integrations/n8n/fsm-engine.education-context.js');
const themeChoicePath = resolve('docs/themes/telegram-theme-choice.png');

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
  const topic = await runFsm('waiting_topic', 'Реформы Петра I');
  assert.deepEqual(topic.updateFields, { topic: 'Реформы Петра I', state: 'waiting_subject' });

  const subject = await runFsm('waiting_subject', 'История', { topic: 'Реформы Петра I' });
  assert.deepEqual(subject.updateFields, { subject: 'История', state: 'waiting_education_stage' });
  assert.match(subject.replyText, /где вы учитесь/i);

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
  assert.deepEqual(classAnswer.updateFields, { school_class: ' 8Г ', student_group: ' 8Г ', state: 'waiting_slide_count' });

  const name = await runFsm('waiting_name', ' Ох ', {
    education_stage: 'school', school_class: ' 8Г ', student_group: ' 8Г ',
    topic: 'Тема', subject: 'Информатик', slide_count: 13,
  });
  assert.deepEqual(name.updateFields, { student_name: ' Ох ', state: 'waiting_style' });
  assert.equal(name.replyPhotoAsset, 'telegram-theme-choice.png');
  assert.equal(name.isReady, false);

  const ready = await runFsm('waiting_style', '1', {
    education_stage: 'school', school_class: ' 8Г ', student_group: ' 8Г ',
    topic: 'Тема', subject: 'Информатик', slide_count: 13, student_name: ' Ох ',
  });
  assert.equal(ready.isReady, true);
  assert.equal(ready.presentationRequest?.studentName, ' Ох ');
  assert.equal(ready.presentationRequest?.group, ' 8Г ');
  assert.equal(ready.presentationRequest?.style, 'deep_blue');
  assert.deepEqual(ready.presentationRequest?.educationContext, { educationStage: 'school', schoolClass: ' 8Г ' });
  assert.doesNotThrow(() => userRequestSchema.parse(ready.presentationRequest));
});

test('university path preserves course and group separately', async () => {
  const course = await runFsm('waiting_course', ' 4 ', { education_stage: 'university' });
  assert.deepEqual(course.updateFields, { course: ' 4 ', state: 'waiting_group' });

  const group = await runFsm('waiting_group', ' ИС-21 ', { education_stage: 'university', course: ' 4 ' });
  assert.deepEqual(group.updateFields, { student_group: ' ИС-21 ', state: 'waiting_slide_count' });

  const ready = await runFsm('waiting_style', '8', {
    education_stage: 'university', course: ' 4 ', student_group: ' ИС-21 ',
    topic: 'Тема', subject: 'История', slide_count: 10, student_name: 'Иван Иванов',
  });
  assert.deepEqual(ready.presentationRequest?.educationContext, { educationStage: 'university', course: ' 4 ' });
  assert.equal(ready.presentationRequest?.group, ' ИС-21 ');
  assert.equal(ready.presentationRequest?.style, 'dynamic_coral');
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

  const style = await runFsm('waiting_style', '9', { education_stage: 'school' });
  assert.deepEqual(style.updateFields, {});
  assert.equal(style.isReady, false);
  assert.equal(style.replyPhotoAsset, 'telegram-theme-choice.png');
});

test('all eight displayed numbers map to supported stable theme identifiers', async () => {
  const expected = [
    'deep_blue', 'business_slate', 'business_emerald', 'minimal_light',
    'minimal_graphite', 'minimal_sand', 'dynamic_violet', 'dynamic_coral',
  ];

  for (const [index, style] of expected.entries()) {
    const result = await runFsm('waiting_style', String(index + 1), {
      education_stage: 'school', school_class: '8Г', student_group: '8Г',
      topic: 'Тема', subject: 'Информатика', slide_count: 10, student_name: 'Ох',
    });
    assert.equal(result.presentationRequest?.style, style);
    assert.doesNotThrow(() => userRequestSchema.parse(result.presentationRequest));
  }
});

test('Telegram theme choice asset is a readable 1200x1600 PNG', async () => {
  const image = await readFile(themeChoicePath);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 1600);
});
