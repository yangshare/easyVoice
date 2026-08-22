import { openai } from '../utils/openai'
import { logger } from '../utils/logger'
import { jsonrepair } from 'jsonrepair'

const MAX_RETRIES = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 从任意文本中提取 JSON 对象字符串
 * 兼容 markdown 代码块包裹、前后夹杂说明文字等情况
 */
function extractJsonString(raw: string): string {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return text
}

/** LLM 分段输出的单条结构（见 prompt/generateSegment.ts 中的 JSON 示例） */
export interface LlmSegment {
  name: string
  character?: string
  rate?: string
  volume?: string
  pitch?: string
  text: string
}

function parseSegments(raw: string): LlmSegment[] {
  // LLM 输出的 JSON 常有单引号、尾逗号、缺引号等瑕疵，先修复再解析
  const params = JSON.parse(jsonrepair(extractJsonString(raw)))
  const segments = params?.segments
  if (!Array.isArray(segments)) {
    throw new Error(
      'LLM 返回的 segments 不是数组，请更换模型或改用 Edge TTS 模式'
    )
  }
  if (segments.length === 0) {
    throw new Error('LLM 返回的分段列表为空，请重试或更换模型')
  }
  return segments
}

/**
 * 单次请求并解析分段参数
 * content 为空时，尝试从 reasoning_content（推理模型）中提取 JSON
 */
async function requestOnce(prompt: string): Promise<LlmSegment[]> {
  const response = await openai.createChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant. You must respond with a single valid JSON object only. Use double quotes for all keys and string values.',
      },
      { role: 'user', content: prompt },
    ],
    // 结构化分段输出任务，低温度可显著减少格式跑偏（单引号、编造字段等）
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const message = response.choices?.[0]?.message
  const content = typeof message?.content === 'string' ? message.content.trim() : ''
  if (content) {
    return parseSegments(content)
  }

  const reasoning =
    typeof (message as any)?.reasoning_content === 'string'
      ? (message as any).reasoning_content
      : ''
  if (reasoning) {
    try {
      return parseSegments(reasoning)
    } catch {
      // reasoning 中没有完整 JSON，走统一报错
    }
  }

  throw new Error(
    'LLM 接口返回内容为空，请检查 openaiBaseUrl 是否为有效的 OpenAI 兼容接口地址（例如以 /v1 结尾，勿填管理台首页）'
  )
}

/**
 * 从 LLM 获取分段列表（带重试）
 * 空响应、JSON 解析失败、网络抖动等偶发错误会自动重试
 */
export async function fetchLLMSegment(prompt: string, maxRetries: number = MAX_RETRIES): Promise<LlmSegment[]> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestOnce(prompt)
    } catch (err) {
      lastError = err
      logger.warn(
        `fetchLLMSegment attempt ${attempt}/${maxRetries} failed: ${(err as Error).message}`
      )
      if (attempt < maxRetries) await sleep(attempt * 1000)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * 过滤并规整 LLM 返回的分段：
 * - 丢弃没有文本的分段
 * - 校验声音名必须在 voiceList 中（LLM 偶尔会编造不存在的声音名，导致 Edge TTS 拒绝连接）
 *   无效时先做大小写无关匹配，仍无效则回退到 fallbackVoice（或列表第一个声音）
 */
export function formatLlmSegments(
  llmSegments: LlmSegment[],
  voiceList: VoiceConfig[],
  fallbackVoice?: string
): any[] {
  const validNames = new Set(voiceList.map((voice) => voice.Name))
  const caseInsensitiveMap = new Map(
    voiceList.map((voice) => [voice.Name.toLowerCase(), voice.Name])
  )
  const fallback =
    fallbackVoice && validNames.has(fallbackVoice) ? fallbackVoice : voiceList[0]?.Name

  return llmSegments
    .filter((segment: any) => segment.text)
    .map((segment: any) => {
      let name = String(segment.name || '').trim()
      if (!validNames.has(name)) {
        name = caseInsensitiveMap.get(name.toLowerCase()) || fallback!
        logger.warn(
          `LLM returned invalid voice "${segment.name}", falling back to "${name}" for text: ${String(segment.text).slice(0, 20)}...`
        )
      }
      return { ...segment, name, voice: name }
    })
}
