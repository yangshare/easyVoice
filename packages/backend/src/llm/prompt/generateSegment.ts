/**
 * 返回 JSON 格式示例（语言无关的结构，中英文模板共用）
 */
const exampleJson = (name: string, characterHint: string, textHint: string) => `{
  "segments": [
    {
      "name": "${name}",
      "character": "${characterHint}",
      "rate": "+0%",
      "volume": "+0%",
      "pitch": "+0Hz",
      "text": "${textHint}"
    }
  ]
}`

const cnTemplate = (voiceList: VoiceConfig[], text: string) => `
我希望你根据以下声音配置和一段文字内容，为文字配音提供优化建议。任务包括：
1. 将文字按场景、角色、旁白分割。
2. 根据角色的性格、对话语气，从声音配置中推荐合适的"name"。
3. 为每段推荐合理的"rate"（语速）、"volume"（音量）、"pitch"（音调）参数。
4. 请不要遗漏语句以及保证语句的顺序。
5. 只返回一个 JSON 对象，不要输出任何解释文字或 markdown 代码块。

### 输出格式要求
- 必须是合法 JSON：所有 key 和字符串值都用双引号包裹，禁止使用单引号、JS 对象字面量写法。
- name 的值只能从下方声音配置的 Name 字段中选择，禁止编造。

### 声音配置
${JSON.stringify(voiceList)}

### 参数说明
- name: 声音配置中的 Name 字段，区分旁白和角色。
- rate: 语速调整，百分比形式，默认 "+0%"（正常），如 "+50%"（加快 50%）、"-20%"（减慢 20%）。
- volume: 音量调整，百分比形式，默认 "+0%"（正常），如 "+20%"（增 20%）、"-10%"（减 10%）。
- pitch: 音调调整，默认 "+0Hz"（正常），如 "+10Hz"（提高 10 赫兹）、"-5Hz"（降低 5 赫兹）。

### 返回 JSON 格式示例
${exampleJson(voiceList[0]?.Name || 'zh-CN-XiaoxiaoNeural', '角色名或narration', '对应的文本段落')}

### 待处理内容
${text}
`
const engTemplate = (voiceList: VoiceConfig[], text: string) => `
Provide dubbing optimization suggestions based on the following voice configuration and text content. Tasks include:
1. Divide the text by scene, role, and narration.
2. Recommend a suitable "name" from the voice configuration based on the character's personality and dialogue tone.
3. Recommend reasonable "rate" (speech speed), "volume", and "pitch" parameters for each paragraph.
4. Do not omit any text and ensure the order of text.
5. Return only a JSON object with no explanations or markdown code fences.

### Output format requirements
- Must be valid JSON: all keys and string values wrapped in double quotes. Single quotes and JS object literal syntax are forbidden.
- The value of "name" must be chosen from the Name fields in the voice configuration below. Never invent voice names.

### Voice configuration
${JSON.stringify(voiceList)}

### Parameter description
- name: Name field in the voice configuration, distinguishing between narration and roles.
- rate: Speech speed adjustment, percentage form, default "+0%" (normal), such as "+50%" (50% faster), "-20%" (20% slower).
- volume: Volume adjustment, percentage form, default "+0%" (normal), such as "+20%" (increase 20%), "-10%" (decrease 10%).
- pitch: Pitch adjustment, default "+0Hz" (normal), such as "+10Hz" (increase 10 Hz), "-5Hz" (decrease 5 Hz).

### Output JSON format example
${exampleJson(voiceList[0]?.Name || 'en-US-JennyNeural', 'role name or narration', 'the corresponding text segment')}

### Content to be processed
${text}
`
export function getPrompt(lang = 'cn', voiceList: VoiceConfig[], text: string) {
  switch (lang) {
    case 'zh':
    case 'cn':
      return cnTemplate(
        voiceList.filter((voice) => voice.Name.startsWith('zh')),
        text
      )
    case 'eng':
      return engTemplate(
        voiceList.filter((voice) => voice.Name.startsWith('en')),
        text
      )
    default:
      throw new Error(`Unsupported language: ${lang}`)
  }
}
